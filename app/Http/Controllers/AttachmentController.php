<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function download(Attachment $attachment): StreamedResponse
    {
        Gate::authorize('view', $attachment->ticket);
        $disk = Storage::disk('local');
        abort_unless($disk->exists($attachment->file_path), 404);

        return $disk->download(
            $attachment->file_path,
            $attachment->original_name,
            ['X-Content-Type-Options' => 'nosniff', 'Content-Disposition' => 'attachment']
        );
    }
}
