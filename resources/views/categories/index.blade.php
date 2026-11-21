@extends('layouts.app')
@section('title', 'Categories')
@section('content')
<div class="page-heading"><div><div class="eyebrow">ADMINISTRATION</div><h1>Ticket categories</h1><p class="muted">Manage the issue types available in the support portal.</p></div></div>
<div class="detail-grid">
    <section class="panel"><h2>Add category</h2><form method="POST" action="{{ route('categories.store') }}" class="form-stack">@csrf<label>Name<input name="name" maxlength="80" required></label><label>Description<input name="description" maxlength="255"></label><button class="btn btn-primary">Create category</button></form></section>
    <section class="panel"><h2>Existing categories</h2>
        @forelse($categories as $category)
        <div class="category-row category-row-edit">
            <form method="POST" action="{{ route('categories.update', $category) }}" class="form-stack category-fields">@csrf @method('PUT')<input type="hidden" name="is_active" value="0">
                <label>Name<input name="name" value="{{ $category->name }}" maxlength="80" required></label>
                <label>Description<input name="description" value="{{ $category->description }}" maxlength="255"></label>
                <label class="check-line"><input type="checkbox" name="is_active" value="1" @checked($category->is_active)> Active</label>
                <small>{{ $category->tickets_count }} tickets</small><button class="btn btn-light btn-sm">Save changes</button>
            </form>
            @if($category->tickets_count === 0)<form method="POST" action="{{ route('categories.destroy', $category) }}" onsubmit="return confirm('Delete this category?')">@csrf @method('DELETE')<button class="btn btn-danger btn-sm">Delete</button></form>@endif
        </div>
        @empty<p class="muted">No categories have been created.</p>@endforelse
    </section>
</div>
@endsection
