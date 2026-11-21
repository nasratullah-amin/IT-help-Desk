@extends('layouts.app')
@section('title', 'Access denied')
@section('content')<section class="panel empty-page"><div class="eyebrow">403 ERROR</div><h1>Access denied</h1><p class="muted">You do not have permission to access this page.</p><a class="btn btn-primary" href="{{ route('dashboard') }}">Return to dashboard</a></section>@endsection
