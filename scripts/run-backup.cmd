@echo off
REM Wrapper for the weekly Task Scheduler backup job (see scripts/schedule-backup.md).
cd /d "C:\Users\Asus\Desktop\Urs_toothfully\toothfully"
call npm run db:backup
