<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Updated</th><th></th></tr></thead><tbody>
@forelse($tickets as $ticket)
<tr><td><a class="ticket-link" href="{{ route('tickets.show', $ticket) }}">#{{ $ticket->id }} · {{ $ticket->subject }}</a><small class="table-sub">By {{ $ticket->user->name }}</small></td><td>{{ $ticket->category->name }}</td><td><span class="pill priority-{{ $ticket->priority }}">{{ ucfirst($ticket->priority) }}</span></td><td><span class="pill status-{{ $ticket->status }}">{{ str_replace('_', ' ', ucfirst($ticket->status)) }}</span></td><td>{{ $ticket->technician?->name ?? 'Unassigned' }}</td><td>{{ $ticket->updated_at->format('d M Y') }}</td><td><a class="text-link" href="{{ route('tickets.show', $ticket) }}">Open</a></td></tr>
@empty<tr><td colspan="7" class="empty-state">No tickets found. Create a ticket to get started.</td></tr>@endforelse
</tbody></table></div>
