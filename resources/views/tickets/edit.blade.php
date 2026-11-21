@extends('layouts.app')
@section('title', 'Edit ticket')
@section('content')
<div class="narrow-page"><div class="page-heading"><div><div class="eyebrow">TICKET #{{ $ticket->id }}</div><h1>Edit ticket</h1></div></div><section class="panel"><form method="POST" action="{{ route('tickets.update', $ticket) }}">@csrf @method('PUT') @include('tickets._form')<div class="form-actions"><a class="btn btn-light" href="{{ route('tickets.show', $ticket) }}">Cancel</a><button class="btn btn-primary">Save changes</button></div></form></section></div>
@endsection
