@extends('layouts.app')
@section('title', 'Login')
@section('content')
<div class="auth-shell"><section class="auth-panel"><div class="eyebrow">SUPPORT PORTAL</div><h1>Welcome back</h1><p class="muted">Sign in to report an issue or manage support requests.</p>
<form method="POST" action="{{ route('login.store') }}" class="form-stack">@csrf
<label>Email address<input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username"></label>
<label>Password<input type="password" name="password" required autocomplete="current-password"></label>
<label class="check-line"><input type="checkbox" name="remember" value="1"> Remember me</label>
<button class="btn btn-primary btn-block">Sign in</button>
</form><p class="auth-switch">New to the portal? <a href="{{ route('register') }}">Create an account</a></p></section><aside class="auth-aside"><div class="aside-icon">✦</div><h2>Technical support, made simple.</h2><p>Submit a ticket, follow its progress and communicate with the support team in one place.</p></aside></div>
@endsection
