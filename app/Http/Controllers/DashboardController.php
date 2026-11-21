<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();
        $base = Ticket::query();
        if ($user->role === 'user') {
            $base->where('user_id', $user->id);
        } elseif ($user->role === 'technician') {
            $base->where('assigned_to', $user->id);
        }

        $tickets = (clone $base)->with(['user:id,name', 'technician:id,name', 'category:id,name'])->latest()->take(8)->get();
        $stats = [
            'total' => (clone $base)->count(),
            'open' => (clone $base)->where('status', 'open')->count(),
            'assigned' => (clone $base)->where('status', 'assigned')->count(),
            'progress' => (clone $base)->where('status', 'in_progress')->count(),
            'resolved' => (clone $base)->where('status', 'resolved')->count(),
            'closed' => (clone $base)->where('status', 'closed')->count(),
            'critical' => (clone $base)->where('priority', 'critical')->count(),
            'high' => (clone $base)->where('priority', 'high')->count(),
        ];

        $adminStats = $user->role === 'admin' ? [
            'users' => User::where('role', 'user')->count(),
            'technicians' => User::where('role', 'technician')->count(),
            'categories' => Category::count(),
        ] : [];

        $activityQuery = TicketHistory::with(['ticket:id,subject', 'user:id,name'])->latest();
        if ($user->role === 'user') {
            $activityQuery->whereHas('ticket', fn ($query) => $query->where('user_id', $user->id));
        } elseif ($user->role === 'technician') {
            $activityQuery->whereHas('ticket', fn ($query) => $query->where('assigned_to', $user->id));
        }
        $recentActivity = $activityQuery->take(8)->get();

        return view('dashboard', compact('tickets', 'stats', 'adminStats', 'recentActivity'));
    }

    public function users(): View
    {
        $users = User::latest()->paginate(15);
        return view('users.index', compact('users'));
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        abort_if($request->user()->id === $user->id, 422, 'You cannot change your own role.');
        $data = $request->validate(['role' => ['required', Rule::in(['user', 'technician', 'admin'])]]);
        $user->update($data);

        return back()->with('success', 'User role updated.');
    }
}
