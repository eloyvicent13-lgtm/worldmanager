<?php

/*
|--------------------------------------------------------------------------
| World Manager - client API
|--------------------------------------------------------------------------
|
| Mounted from routes/api-client.php under:
|   /api/client/servers/{server}/world-manager
|
| The parent group already applies the standard client middleware stack, so
| authentication, subuser access and activity subjects are handled for us.
|
*/

use Illuminate\Support\Facades\Route;
use Pterodactyl\WorldManager\Http\WorldManagerController;

Route::get('/', [WorldManagerController::class, 'index']);
Route::get('/detect', [WorldManagerController::class, 'detect']);

Route::get('/settings', [WorldManagerController::class, 'settings']);
Route::put('/settings', [WorldManagerController::class, 'updateSettings']);

Route::get('/upload-url', [WorldManagerController::class, 'uploadUrl']);
Route::post('/import', [WorldManagerController::class, 'import']);

Route::post('/activate', [WorldManagerController::class, 'activate']);
Route::post('/rename', [WorldManagerController::class, 'rename']);
Route::post('/duplicate', [WorldManagerController::class, 'duplicate']);
Route::post('/download', [WorldManagerController::class, 'download']);
Route::post('/reset', [WorldManagerController::class, 'reset']);
Route::post('/delete', [WorldManagerController::class, 'delete']);
