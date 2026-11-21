<div class="form-stack">
<label>Subject<input type="text" name="subject" value="{{ old('subject', $ticket->subject ?? '') }}" maxlength="160" required></label>
<label>Category<select name="category_id" required><option value="">Select category</option>@foreach($categories as $category)<option value="{{ $category->id }}" @selected((string)old('category_id', $ticket->category_id ?? '') === (string)$category->id)>{{ $category->name }}</option>@endforeach</select></label>
<label>Priority<select name="priority" required>@foreach(['low','medium','high','critical'] as $priority)<option value="{{ $priority }}" @selected(old('priority', $ticket->priority ?? 'medium') === $priority)>{{ ucfirst($priority) }}</option>@endforeach</select></label>
<label>Description<textarea name="description" rows="7" required minlength="10" maxlength="10000">{{ old('description', $ticket->description ?? '') }}</textarea></label>
@if(!isset($ticket))<label>Attachment <span class="muted inline-note">PDF, image or document · max 5 MB</span><input type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"></label>@endif
</div>
