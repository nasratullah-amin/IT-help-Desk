<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'IT Help Desk') | Support Portal</title>
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
    <header class="topbar">
        <div class="container nav-wrap">
            <a class="brand" href="{{ auth()->check() ? route('dashboard') : route('login') }}"><span class="brand-mark">H</span> HelpDesk</a>
            @auth
                <nav class="main-nav">
                    <a href="{{ route('dashboard') }}">Dashboard</a>
                    <a href="{{ route('tickets.index') }}">Tickets</a>
                    @if(auth()->user()->role === 'admin')
                        <a href="{{ route('categories.index') }}">Categories</a>
                        <a href="{{ route('users.index') }}">Users</a>
                    @endif
                </nav>
                <div class="nav-user">
                    <span>{{ auth()->user()->name }} <small>{{ ucfirst(auth()->user()->role) }}</small></span>
                    <form method="POST" action="{{ route('logout') }}">@csrf<button class="btn btn-outline btn-sm">Logout</button></form>
                </div>
            @endauth
        </div>
    </header>
    <main class="container page-content">
        @if(session('success'))<div class="alert alert-success">{{ session('success') }}</div>@endif
        @if($errors->any())
            <div class="alert alert-error"><strong>Please correct the following:</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>
        @endif
        @yield('content')
    </main>
    <footer class="footer"><div class="container">IT Help Desk Ticketing System</div></footer>
</body>
</html>
