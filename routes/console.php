<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('app:about', function () {
    $this->comment('IT Help Desk Ticketing System');
})->purpose('Display application information');
