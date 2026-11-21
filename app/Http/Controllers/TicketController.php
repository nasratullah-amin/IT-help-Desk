<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Category;
use App\Models\Comment;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TicketController extends Controller
{
    private const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
    private const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    public function index(Request $request): View
    {
        Gate::authorize('viewAny', Ticket::class);
        $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'priority' => ['nullable', Rule::in(self::PRIORITIES)],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'technician_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'technician')],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'sort' => ['nullable', Rule::in(['newest', 'oldest', 'updated', 'priority'])],
        ]);
        $user = $request->user();
        $query = Ticket::with(['user:id,name', 'technician:id,name', 'category:id,name']);

        if ($user->role === 'user') {
            $query->where('user_id', $user->id);
        } elseif ($user->role === 'technician') {
            $query->where('assigned_to', $user->id);
        }

        $query->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->input('priority')))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('technician_id') && $user->role === 'admin', fn ($q) => $q->where('assigned_to', $request->integer('technician_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('created_at', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('created_at', '<=', $request->input('to')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = trim((string) $request->input('search'));
                $q->where(fn ($s) => $s->where('subject', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhere('id', ctype_digit($term) ? (int) $term : 0));
            });

        $sort = $request->input('sort', 'newest');
        match ($sort) {
            'oldest' => $query->oldest(),
            'priority' => $query->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END"),
            'updated' => $query->orderByDesc('updated_at'),
            default => $query->latest(),
        };

        $tickets = $query->paginate(12)->withQueryString();
        $categories = Category::where('is_active', true)->orderBy('name')->get();
        $technicians = $user->role === 'admin'
            ? User::where('role', 'technician')->orderBy('name')->get()
            : collect();

        return view('tickets.index', compact('tickets', 'categories', 'technicians'));
    }

    public function create(): View
    {
        Gate::authorize('create', Ticket::class);
        $categories = Category::where('is_active', true)->orderBy('name')->get();
        return view('tickets.create', compact('categories'));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Ticket::class);
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:160'],
            'description' => ['required', 'string', 'min:10', 'max:10000'],
            'category_id' => ['required', Rule::exists('categories', 'id')->where('is_active', true)],
            'priority' => ['required', Rule::in(self::PRIORITIES)],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,png,jpg,jpeg,txt,doc,docx'],
        ]);

        DB::transaction(function () use ($request, $data, &$ticket) {
            $ticket = Ticket::create([
                'user_id' => $request->user()->id,
                'category_id' => $data['category_id'],
                'subject' => $data['subject'],
                'description' => $data['description'],
                'priority' => $data['priority'],
                'status' => 'open',
            ]);
            $this->history($ticket, $request->user()->id, 'created', null, 'open', 'Ticket created');
            if ($request->hasFile('attachment')) {
                $this->storeAttachment($request, $ticket);
            }
        });

        return redirect()->route('tickets.show', $ticket)->with('success', 'Ticket created successfully.');
    }

    public function show(Request $request, Ticket $ticket): View
    {
        Gate::authorize('view', $ticket);
        $ticket->load([
            'user:id,name,email', 'technician:id,name', 'category:id,name',
            'comments.user:id,name,role', 'attachments.user:id,name',
            'histories.user:id,name',
        ]);
        $technicians = $request->user()->role === 'admin'
            ? User::where('role', 'technician')->orderBy('name')->get()
            : collect();

        return view('tickets.show', compact('ticket', 'technicians'));
    }

    public function edit(Ticket $ticket): View
    {
        Gate::authorize('update', $ticket);
        $categories = Category::where('is_active', true)->orderBy('name')->get();
        return view('tickets.edit', compact('ticket', 'categories'));
    }

    public function update(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('update', $ticket);
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:160'],
            'description' => ['required', 'string', 'min:10', 'max:10000'],
            'category_id' => ['required', Rule::exists('categories', 'id')->where('is_active', true)],
            'priority' => ['required', Rule::in(self::PRIORITIES)],
        ]);

        DB::transaction(function () use ($request, $ticket, $data) {
            foreach (['priority', 'category_id'] as $field) {
                if ((string) $ticket->{$field} !== (string) $data[$field]) {
                    $this->history($ticket, $request->user()->id, $field.'_changed', (string) $ticket->{$field}, (string) $data[$field], ucfirst(str_replace('_', ' ', $field)).' changed');
                }
            }
            $ticket->update($data);
            $this->history($ticket, $request->user()->id, 'details_updated', null, null, 'Ticket details updated');
        });

        return redirect()->route('tickets.show', $ticket)->with('success', 'Ticket updated.');
    }

    public function destroy(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('delete', $ticket);
        foreach ($ticket->attachments as $attachment) {
            Storage::disk('local')->delete($attachment->file_path);
        }
        $ticket->delete();

        return redirect()->route('tickets.index')->with('success', 'Ticket deleted.');
    }

    public function comment(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('comment', $ticket);
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:3000']]);
        DB::transaction(function () use ($request, $ticket, $data) {
            Comment::create(['ticket_id' => $ticket->id, 'user_id' => $request->user()->id, 'body' => $data['body']]);
            $this->history($ticket, $request->user()->id, 'comment_added', null, null, 'Comment added');
        });

        return back()->with('success', 'Comment added.');
    }

    public function attachment(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('attach', $ticket);
        $request->validate(['attachment' => ['required', 'file', 'max:5120', 'mimes:pdf,png,jpg,jpeg,txt,doc,docx']]);
        $this->storeAttachment($request, $ticket);

        return back()->with('success', 'Attachment uploaded.');
    }

    public function status(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('manage', $ticket);
        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $transitions = [
            'open' => ['assigned'],
            'assigned' => ['in_progress', 'open'],
            'in_progress' => ['resolved', 'assigned'],
            'resolved' => ['closed', 'in_progress'],
            'closed' => [],
        ];
        $old = $ticket->status;
        abort_unless(in_array($data['status'], $transitions[$old] ?? [], true), 422, 'This status transition is not allowed.');

        DB::transaction(function () use ($request, $ticket, $data, $old) {
            $ticket->status = $data['status'];
            $ticket->resolved_at = in_array($data['status'], ['resolved', 'closed'], true) ? now() : null;
            $ticket->save();
            $action = match ($ticket->status) {
                'resolved' => 'ticket_resolved',
                'closed' => 'ticket_closed',
                default => 'status_changed',
            };
            $this->history($ticket, $request->user()->id, $action, $old, $ticket->status, $data['note'] ?? 'Status updated');
        });

        return back()->with('success', 'Ticket status updated.');
    }

    public function assign(Request $request, Ticket $ticket): RedirectResponse
    {
        Gate::authorize('assign', $ticket);
        $data = $request->validate([
            'assigned_to' => ['nullable', Rule::exists('users', 'id')->where('role', 'technician')],
        ]);
        $oldId = $ticket->assigned_to;
        $newId = $data['assigned_to'] ?? null;

        $oldStatus = $ticket->status;
        DB::transaction(function () use ($request, $ticket, $oldId, $newId, $oldStatus) {
            $ticket->assigned_to = $newId;
            if ($newId && $ticket->status === 'open') {
                $ticket->status = 'assigned';
            } elseif (!$newId && $ticket->status === 'assigned') {
                $ticket->status = 'open';
            }
            $ticket->save();
            if ((string) $oldId !== (string) $newId) {
                $oldName = $oldId ? User::find($oldId)?->name : 'Unassigned';
                $newName = $newId ? User::find($newId)?->name : 'Unassigned';
                $this->history($ticket, $request->user()->id, 'technician_assigned', $oldName, $newName, 'Technician assignment changed');
            }
            if ($ticket->status !== $oldStatus) {
                $this->history($ticket, $request->user()->id, 'status_changed', $oldStatus, $ticket->status, 'Status updated by assignment');
            }
        });

        return back()->with('success', 'Technician assignment updated.');
    }

    private function storeAttachment(Request $request, Ticket $ticket): void
    {
        $file = $request->file('attachment');
        $path = $file->store('ticket-attachments', 'local');

        $originalName = preg_replace('/[^\\pL\\pN._ -]/u', '_', basename($file->getClientOriginalName())) ?: 'attachment';

        Attachment::create([
            'ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'original_name' => Str::limit($originalName, 180, ''),
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ]);
        $this->history($ticket, $request->user()->id, 'attachment_uploaded', null, null, 'Attachment uploaded');
    }

    private function history(Ticket $ticket, ?int $userId, string $action, ?string $from, ?string $to, ?string $note): void
    {
        TicketHistory::create([
            'ticket_id' => $ticket->id,
            'user_id' => $userId,
            'action' => $action,
            'from_value' => $from,
            'to_value' => $to,
            'from_status' => in_array($action, ['status_changed', 'ticket_resolved', 'ticket_closed'], true) ? $from : null,
            'to_status' => in_array($action, ['status_changed', 'ticket_resolved', 'ticket_closed'], true) ? $to : null,
            'note' => $note,
        ]);
    }
}
