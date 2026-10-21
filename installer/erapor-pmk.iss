#define AppName "e-Rapor SMK Pratama Mulya - Aplikasi administrasi guru terpadu"
#define AppVersion "0.1.4"
#define StagePath "..\\dist\\windows\\stage\\erapor-pmk"

[Setup]
AppId={{06E10F9F-0AD2-4F31-A64B-7C3B36F2D0D6}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher="e-Rapor SMK Pratama Mulya"
AppPublisherURL="https://github.com/athuridha/eraport"
; Install under the current user's Local AppData so admin privileges are not required
DefaultDirName={localappdata}\erapor-pmk
DefaultGroupName=e-Rapor SMK Pratama Mulya
DisableProgramGroupPage=yes
OutputDir=..\dist\windows
OutputBaseFilename=ERaporPMKSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Artwork wizard (dirender dari installer/assets/wizard.html lewat paket script logo:wizard)
WizardImageFile=assets\wizard-large.bmp
WizardSmallImageFile=assets\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Do not require administrator privileges when installing to per-user LocalAppData
PrivilegesRequired=lowest
; Aplikasi ini adalah server lokal: saat upgrade, node.exe sering masih memegang
; berkas (terutama node_modules\@libsql\win32-x64-msvc\index.node). Tanpa dua baris
; di bawah, installer berhenti di tengah ("DeleteFile failed; code 5"), rollback,
; dan menyisakan instalasi campuran lama+baru yang tidak bisa dijalankan.
; CloseApplications=force menutup proses yang terdeteksi RestartManager tanpa
; bertanya (instalasi /SILENT tidak bisa menampilkan dialog); RestartApplications=no
; karena aplikasi tidak boleh dihidupkan lagi diam-diam. Untuk berkas yang tetap
; terkunci (addon native sering tak terdeteksi RestartManager), flag restartreplace
; pada [Files] menjadwalkan penggantian setelah reboot, bukan menggagalkan install.
CloseApplications=force
RestartApplications=no
UninstallDisplayIcon={app}\erapor-pmk.ico
VersionInfoVersion={#AppVersion}
SetupIconFile={#StagePath}\erapor-pmk.ico
LicenseFile="..\LICENSE"
; Code signing configuration (commented out by default)
; Uncomment and configure these lines if you want Inno Setup to sign the installer
; SignTool=custom "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /d "Administrasi guru terpadu Installer" /f "installer\cert\codesign.pfx" /p "YOUR_PASSWORD" $f
; SignedUninstaller=yes

[Files]
Source:"{#StagePath}\\*"; DestDir:"{app}"; Excludes:".env"; Flags: ignoreversion restartreplace recursesubdirs createallsubdirs
; .env staged by pnpm package:win memuat kredensial cloud. onlyifdoesntexist
; menjaga .env milik pengguna tetap utuh saat upgrade.
Source:"{#StagePath}\\.env"; DestDir:"{app}"; Flags: ignoreversion restartreplace onlyifdoesntexist
; Selalu diperbarui tiap instalasi: pelengkap .env (kredensial cloud terbaru).
; start-build.mjs hanya memakai nilainya untuk kunci yang belum ada di .env.
Source:"{#StagePath}\\.env"; DestDir:"{app}"; DestName:".env.default"; Flags: ignoreversion restartreplace
Source:"files\\start-erapor-pmk.mjs"; DestDir:"{app}"; Flags: ignoreversion restartreplace
; Pemilih runtime: pakai {app}\runtime\node\node.exe bila ada, jika tidak node dari PATH.
Source:"files\\run-node.cmd"; DestDir:"{app}"; Flags: ignoreversion restartreplace
; Penyedia runtime Node.js (diunduh hanya bila mesin belum punya Node di PATH).
Source:"scripts\\ensure-node.ps1"; DestDir:"{app}\\scripts"; Flags: ignoreversion restartreplace
Source:"scripts\\ensure-node.cmd"; DestDir:"{app}\\scripts"; Flags: ignoreversion restartreplace
Source:"..\dist\windows\vc_redist.x64.exe"; DestDir:"{tmp}"; Flags: ignoreversion deleteafterinstall

[Run]
; Dijalankan lebih dulu: menyiapkan runtime Node.js lokal bila mesin belum punya.
Filename:"{cmd}"; Parameters:"/c ""{app}\scripts\ensure-node.cmd"""; WorkingDir:"{app}"; StatusMsg:"Menyiapkan runtime Node.js..."; Flags: runhidden waituntilterminated
Filename:"{cmd}"; Parameters:"/c ""{app}\run-node.cmd"" scripts\migrate-installed-db.mjs"; WorkingDir:"{app}"; StatusMsg:"Menjalankan migrasi database (drizzle-kit) pada mesin ini..."; Flags: runhidden waituntilterminated

[Icons]
Name:"{autoprograms}\erapor-pmk\e-Rapor SMK Pratama Mulya"; Filename:"{app}\\run-node.cmd"; Parameters:"start-erapor-pmk.mjs"; WorkingDir:"{app}"; IconFilename:"{app}\erapor-pmk.ico"
Name:"{autodesktop}\e-Rapor SMK Pratama Mulya"; Filename:"{app}\\run-node.cmd"; Parameters:"start-erapor-pmk.mjs"; WorkingDir:"{app}"; IconFilename:"{app}\erapor-pmk.ico"

[Code]

function VCRedistNeedsInstall: Boolean;
var
	Version: string;
begin
	Result := True;
	if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64', 'Version', Version) then
	begin
		Log('VC++ 2015-2022 Redistributable (x64) sudah terinstall: ' + Version);
		Result := False;
	end
	else
	begin
		Log('VC++ 2015-2022 Redistributable (x64) belum terinstall.');
	end;
end;

procedure InstallVcRedist;
var
	ResultCode: Integer;
	RedistPath: string;
begin
	if not VCRedistNeedsInstall then
	begin
		Log('Melewati instalasi VC++ Redistributable (sudah terinstall).');
		Exit;
	end;

	RedistPath := ExpandConstant('{tmp}\vc_redist.x64.exe');
	if not FileExists(RedistPath) then
	begin
		Log('File VC++ redistributable tidak ditemukan di ' + RedistPath);
		Exit;
	end;

	Log('Menginstall Microsoft Visual C++ Redistributable 2015-2022...');
	if ShellExec('runas', RedistPath, '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
	begin
		if ResultCode = 0 then
			Log('VC++ Redistributable berhasil diinstall.')
		else
			Log(Format('VC++ Redistributable selesai dengan kode: %d', [ResultCode]));
	end
	else
	begin
		Log(Format('Gagal menjalankan VC++ Redistributable installer. Kode: %d', [ResultCode]));
	end;
end;

procedure StopRunningApp;
var
	ResultCode: Integer;
	AppPath, Script: string;
begin
	AppPath := ExpandConstant('{app}');
	// CloseApplications/RestartManager tidak mengenali node.exe yang memegang
	// node_modules\@libsql\win32-x64-msvc\index.node, sehingga upgrade saat aplikasi
	// masih hidup gagal dengan "DeleteFile failed; code 5" dan instalasi campur.
	// Jadi hentikan sendiri proses node milik aplikasi ini.
	// Proses server dijalankan oleh peluncur sebagai `node start-build.mjs` (tanpa
	// path aplikasi di command line), jadi pencocokan lewat path saja tidak cukup.
	Script :=
		'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ''node.exe'' -and (' +
		'$_.CommandLine -like ''*' + AppPath + '*'' -or ' +
		'$_.CommandLine -like ''*start-build.mjs*'' -or ' +
		'$_.CommandLine -like ''*start-erapor-pmk.mjs*'') } | ' +
		'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
	if Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "' + Script + '"',
		'', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
		Log(Format('StopRunningApp selesai (kode %d)', [ResultCode]))
	else
		Log('StopRunningApp: gagal menjalankan powershell');
	// beri waktu handle file dilepas sebelum penyalinan dimulai
	Sleep(2500);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
	EnvPath, DbPath, DbDir, S, SrcDb, LogDir, LogFile, SoundDir: string;
begin
	if CurStep = ssInstall then
	begin
		StopRunningApp;
	end
	else if CurStep = ssPostInstall then
	begin
		InstallVcRedist;
		DbPath := ExpandConstant('{localappdata}\erapor-pmk-data\database.sqlite3');
		DbDir := ExtractFileDir(DbPath);
		if not DirExists(DbDir) then
			ForceDirectories(DbDir);
			// If the user doesn't already have a DB in their user state, copy the packaged one
			SrcDb := ExpandConstant('{localappdata}\erapor-pmk\data\database.sqlite3');
			if (not FileExists(DbPath)) and FileExists(SrcDb) then
			begin
				if not CopyFile(SrcDb, DbPath, False) then
					Log(Format('Failed to copy initial database from %s to %s', [SrcDb, DbPath]));
			end;

			// Ensure log directory and empty log file exist
			LogDir := ExpandConstant('{localappdata}\erapor-pmk-data\logs');
			if not DirExists(LogDir) then
				ForceDirectories(LogDir);
			LogFile := LogDir + '\\erapor-pmk.log';
			if not FileExists(LogFile) then
				SaveStringToFile(LogFile, '', False);
		// Ensure sounds directory exists
			SoundDir := ExpandConstant('{localappdata}\erapor-pmk-data\sounds');
			if not DirExists(SoundDir) then
				ForceDirectories(SoundDir);

		// Preserve an existing .env across upgrades — it may hold custom
		// photo/sounds overrides, a rotated cloud token, or point at a moved
		// data root. Only a fresh install writes the initial .env here.
		// Catatan: .env bawaan (berisi kredensial cloud) sudah dipasang dari
		// [Files], jadi blok ini hanya jaring pengaman kalau .env hilang.
		// Uploads/sounds are NOT pinned: they follow the data root
		// automatically (default <root>/uploads and <root>/sounds), and the
		// root itself lives in the launcher override file
		// (%LOCALAPPDATA%\erapor-pmk-data\data-root.txt), not in .env.
		EnvPath := ExpandConstant('{app}\.env');
		if FileExists(EnvPath) then
			Log(Format('Menjaga .env yang sudah ada: %s', [EnvPath]))
		else
		begin
			S := 'DB_URL="file:' + DbPath + '"' + #13#10 + 'BODY_SIZE_LIMIT=5M';
			if SaveStringToFile(EnvPath, S, False) then
				Log(Format('Wrote .env to %s', [EnvPath]))
			else
				Log(Format('Failed to write .env to %s', [EnvPath]));
		end;
	end;
end;