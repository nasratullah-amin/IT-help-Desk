@extends('layouts.app')
@section('title', 'Dashboard')
@section('content')
<div class="page-heading">
    <div><div class="eyebrow">OVERVIEW</div><h1>Good day, {{ auth()->user()->name }}</h1><p class="muted">Your support workspace at a glance.</p></div>
    @if(auth()->user()->role !== 'technician')<a class="btn btn-primary" href="{{ route('tickets.create') }}">＋ New ticket</a>@endif
</div>
@if(auth()->user()->role === 'admin')
<div class="stat-grid">
    <div class="stat-card"><span>All tickets</span><strong>{{ $stats['total'] }}</strong><small>Across the organization</small></div>
    <div class="stat-card"><span>Open</span><strong>{{ $stats['open'] }}</strong><small>Awaiting assignment</small></div>
    <div class="stat-card"><span>In progress</span><strong>{{ $stats['progress'] }}</strong><small>Being worked on</small></div>
    <div class="stat-card"><span>Resolved</span><strong>{{ $stats['resolved'] }}</strong><small>Awaiting closure</small></div>
    <div class="stat-card"><span>Closed</span><strong>{{ $stats['closed'] }}</strong><small>Completed tickets</small></div>
    <div class="stat-card"><span>Critical priority</span><strong>{{ $stats['critical'] }}</strong><small>Needs urgent attention</small></div>
    <div class="stat-card"><span>Users</span><strong>{{ $adminStats['users'] }}</strong><small>Registered requesters</small></div>
    <div class="stat-card"><span>Technicians</span><strong>{{ $adminStats['technicians'] }}</strong><small>Support team members</small></div>
</div>
@elseif(auth()->user()->role === 'technician')
<div class="stat-grid">
    <div class="stat-card"><span>Assigned tickets</span><strong>{{ $stats['total'] }}</strong><small>Currently assigned to you</small></div>
    <div class="stat-card"><span>Open</span><strong>{{ $stats['open'] }}</strong><small>Awaiting acceptance</small></div>
    <div class="stat-card"><span>In progress</span><strong>{{ $stats['progress'] }}</strong><small>Work in progress</small></div>
    <div class="stat-card"><span>High / critical</span><strong>{{ $stats['high'] + $stats['critical'] }}</strong><small>Priority attention</small></div>
</div>
@else
<div class="stat-grid">
    <div class="stat-card"><span>My tickets</span><strong>{{ $stats['total'] }}</strong><small>All your support requests</small></div>
    <div class="stat-card"><span>Open</span><strong>{{ $stats['open'] }}</strong><small>Waiting for support</small></div>
    <div class="stat-card"><span>In progress</span><strong>{{ $stats['progress'] + $stats['assigned'] }}</strong><small>Being handled</small></div>
    <div class="stat-card"><span>Resolved / closed</span><strong>{{ $stats['resolved'] + $stats['closed'] }}</strong><small>Completed requests</small></div>
</div>
@endif
<section class="panel">
    <div class="panel-heading"><div><h2>Recent tickets</h2><p class="muted">Latest support requests</p></div><a class="text-link" href="{{ route('tickets.index') }}">View all tickets →</a></div>
    @include('tickets.partials.table', ['tickets' => $tickets])
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Recent activity</h2><p class="muted">Latest updates on tickets visible to you</p></div></div>
    <div class="timeline">
        @forelse($recentActivity as $event)
            <div class="timeline-item"><strong>{{ str_replace('_', ' ', ucfirst($event->action)) }}</strong><p>{{ $event->note ?: 'Ticket updated' }} · <a href="{{ route('tickets.show', $event->ticket_id) }}">#{{ $event->ticket_id }} {{ $event->ticket?->subject }}</a></p><small>{{ $event->user?->name ?? 'Former user' }} · {{ $event->created_at->format('d M Y, H:i') }}</small></div>
        @empty
            <p class="muted">No activity recorded yet.</p>
        @endforelse
    </div>
</section>
@endsection
