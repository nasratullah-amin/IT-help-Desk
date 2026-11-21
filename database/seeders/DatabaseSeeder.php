<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@helpdesk.test'],
            ['name' => 'System Admin', 'password' => Hash::make('Admin@12345'), 'role' => 'admin']
        );

        User::firstOrCreate(
            ['email' => 'technician@helpdesk.test'],
            ['name' => 'IT Technician', 'password' => Hash::make('Tech@12345'), 'role' => 'technician']
        );

        Category::firstOrCreate(['name' => 'Hardware'], ['description' => 'Computer, printer and device issues']);
        Category::firstOrCreate(['name' => 'Software'], ['description' => 'Operating system and application issues']);
        Category::firstOrCreate(['name' => 'Network'], ['description' => 'Internet, Wi-Fi and connectivity issues']);
        Category::firstOrCreate(['name' => 'Account Access'], ['description' => 'Login, password and account access issues']);
        Category::firstOrCreate(['name' => 'Security'], ['description' => 'Security incidents and access concerns']);
        Category::firstOrCreate(['name' => 'Other'], ['description' => 'Other technical support requests']);
    }
}
