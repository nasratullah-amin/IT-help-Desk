<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;

class TicketPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['user', 'technician', 'admin'], true);
    }

    public function view(User $user, Ticket $ticket): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'user' && $ticket->user_id === $user->id)
            || ($user->role === 'technician' && $ticket->assigned_to === $user->id);
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['user', 'admin'], true);
    }

    public function update(User $user, Ticket $ticket): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'user' && $ticket->user_id === $user->id && $ticket->status === 'open');
    }

    public function delete(User $user, Ticket $ticket): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'user' && $ticket->user_id === $user->id && $ticket->status === 'open');
    }

    public function manage(User $user, Ticket $ticket): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'technician' && $ticket->assigned_to === $user->id);
    }

    public function assign(User $user, Ticket $ticket): bool
    {
        return $user->role === 'admin';
    }

    public function comment(User $user, Ticket $ticket): bool
    {
        return $this->view($user, $ticket);
    }

    public function attach(User $user, Ticket $ticket): bool
    {
        return $this->view($user, $ticket);
    }
}
