@extends('layouts.app')
@section('title', 'Tickets')
@section('content')
<div class="page-heading"><div><div class="eyebrow">SUPPORT REQUESTS</div><h1>Tickets</h1><p class="muted">Search, filter and track technical support requests.</p></div>@if(auth()->user()->role !== 'technician')<a class="btn btn-primary" href="{{ route('tickets.create') }}">＋ New ticket</a>@endif</div>
<form method="GET" class="filter-bar">
    <input type="search" name="search" placeholder="Search subject, description or ID" value="{{ request('search') }}">
    <select name="status"><option value="">All statuses</option>@foreach(['open','assigned','in_progress','resolved','closed'] as $s)<option value="{{ $s }}" @selected(request('status') === $s)>{{ str_replace('_',' ',ucfirst($s)) }}</option>@endforeach</select>
    <select name="priority"><option value="">All priorities</option>@foreach(['low','medium','high','critical'] as $p)<option value="{{ $p }}" @selected(request('priority') === $p)>{{ ucfirst($p) }}</option>@endforeach</select>
    <select name="category_id"><option value="">All categories</option>@foreach($categories as $category)<option value="{{ $category->id }}" @selected((string)request('category_id') === (string)$category->id)>{{ $category->name }}</option>@endforeach</select>
    @if(auth()->user()->role === 'admin')
    <select name="technician_id"><option value="">All technicians</option>@foreach($technicians as $technician)<option value="{{ $technician->id }}" @selected((string)request('technician_id') === (string)$technician->id)>{{ $technician->name }}</option>@endforeach</select>
    @endif
    <input type="date" name="from" aria-label="Created from" value="{{ request('from') }}"><input type="date" name="to" aria-label="Created to" value="{{ request('to') }}">
    <select name="sort"><option value="newest" @selected(request('sort','newest') === 'newest')>Newest first</option><option value="oldest" @selected(request('sort') === 'oldest')>Oldest first</option><option value="updated" @selected(request('sort') === 'updated')>Recently updated</option><option value="priority" @selected(request('sort') === 'priority')>Priority</option></select>
    <button class="btn btn-dark">Apply filters</button><a class="btn btn-light" href="{{ route('tickets.index') }}">Reset</a>
</form>
<section class="panel">@include('tickets.partials.table', ['tickets' => $tickets])<div class="pagination-wrap">{{ $tickets->links() }}</div></section>
@endsection
