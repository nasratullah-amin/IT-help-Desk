@extends('layouts.app')
@section('title', 'New ticket')
@section('content')
<div class="narrow-page"><div class="page-heading"><div><div class="eyebrow">NEW REQUEST</div><h1>Report a problem</h1><p class="muted">Describe the issue so the support team can help.</p></div></div><section class="panel"><form method="POST" action="{{ route('tickets.store') }}" enctype="multipart/form-data">@csrf @include('tickets._form')<div class="form-actions"><a class="btn btn-light" href="{{ route('tickets.index') }}">Cancel</a><button class="btn btn-primary">Submit ticket</button></div></form></section></div>
@endsection
