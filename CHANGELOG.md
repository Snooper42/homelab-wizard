# Changelog

What changed in each version of Homelab Wizard, newest first. Each version's notes are also its release notes on GitHub, and what the app shows before an update.

Notes are grouped as **New**, **Improved**, and **Fixed**, one line each, in plain words. The pull requests behind a version hold the details. Versions before 0.9.0-beta were tagged afterwards, at the commit where each one ended.

## [Unreleased]

### New

- **A sheet of shortcuts:** press ? on any screen, or pick *Keyboard shortcuts* in the command palette, for that screen's own shortcuts first (typing to filter Status, the calendar's keys on Finances), then those that work everywhere and each screen's key, as this computer writes them.
- **Quick actions on the phone:** on a phone that may make changes, hold an app's row on Status for its menu: Open, Start, Restart, Stop, Stop for a while, and Logs. A phone that only looks, and a wall screen, have none.
- **A sheet for the fridge:** each person's welcome page links to their apps on one printed page, each with its address, its phone app, and a code the phone's camera opens; the sheet never has their sign-in link or a password.
- **Suggestions from what you use:** Choose stacks › Add more opens on the apps that go with ones you run, each with what it brings them: Beets with Navidrome, Bazarr and Prowlarr with Sonarr and Radarr, Paperless-AI with Paperless-ngx, Seerr and Tdarr with Jellyfin.
- **Quiet hours:** from 10 PM to 7 AM alerts reach the phone without a sound, unless they are serious: the password vault not answering, or backups failing two nights running. Settings › Quiet hours picks other hours, or off.
- **Two apps that do the same job:** Choose stacks says when you already run one that does it (Komga and Kavita, Mealie and Tandoor, Navidrome and Jellyfin's music), and why you might keep one or both.
- **What the apps have saved so far:** on Status, hover (or Tab to) the figure under *Replaces a year* for what they have saved since the first nightly record, and month by month.
- **What changed since last night:** on Backups, each app's copy shows the night before's size on hover, and beside it when it moved by a tenth; a copy less than half the night before's is marked in red, so an app that lost its data is noticed before the old copies age out.
- **What CrowdSec stopped:** the proxy's page (and CrowdSec's) lists every address stopped since midnight, with where it came from, what it tried, the time, and whether it's still banned.
- **What happened overnight:** in the morning, Status's first line sums up the night since 8 PM: *Overnight: 4 apps updated, 1 rolled back, a backup of 2.1 GB, nothing needed you*, or which app was down. **Hide until tomorrow** puts it away for the day.
- **A restart that keeps failing:** an app Docker restarted 3 times within an hour is stopped instead of restarting forever, and the alert carries its last log lines. Its row on Status says so with a red dot until you start it again.
- **An update's notes:** hover *updates held* on Status for why the app is held, how to put it back, and the first lines of its newest release, read from GitHub only when you look.
- **A backup's contents:** on Backups, hover an off-site job's time (or Tab to it) for its last run and how long it took, what it holds of yours and in how many files, its size where it is kept and the versions to go back to, the folders it copies, and its next run.
- **Remember where you were:** each screen keeps how far down you were and which of its sections were open, between visits and after quitting. Picking another screen opens it at its own place, no longer partway down where the last one was.
- **What changed since you looked:** each app on Status that restarted, updated, stopped, or started since you were last there has a dot beside its name saying which, until you leave Status again.
- **Open, your way:** on Status, Alt-click (⌥-click on a Mac) an app's address to copy it, and Shift-click (⇧-click) **Open** to use its address on this computer when the domain does not answer.
- **Pinned apps:** right-click an app on Status and pick **Pin to the top** to keep the apps you open most in a Pinned group at the top, in the order you pinned them, and first in the menu bar's Open an app. `homelab pin <app>` does it from the Terminal.
- **Right-click the sidebar:** a screen's own menu, without opening it first: Status's Check again and Update all; Backups' Back up now and Test a restore; Finances' Add a transaction, Update balances, and Hide amounts. Shift+F10 opens it from the keyboard.
- **Why an app restarted:** hover *up 9 minutes* on Status for why it last started, and when: you, an update (yours or the nightly one), Fix it, the watchdog, the power coming back, its drive plugged in again, the end of a Stop for a while, or Docker after it stopped on its own.
- **A balance's accounts:** rest the pointer on Cash, Investments, or another group in the sidebar for its accounts, each with its balance and how long since it was updated; one older than a month has a dot.
- **When an app was down this week:** hover its *96.2% up this week* on Status (or Tab to it, or tap it on a phone) for the week as a strip, with each time it was down, for how long, and why (*Wed 3:15 AM, 45 minutes: nothing answers on its port*).
- **Export your finances:** Finances has **Export**: your whole plan as a JSON file to keep or take elsewhere, the year ahead as a spreadsheet (each payday and payment, with checking after each day), and this month or the next as a page that prints itself. Saved where you pick, readable only by you; on a phone, shared or downloaded, even one that may only look.
- **Tidy Up gets ffmpeg for you:** without ffmpeg, Tidy Up's Overview has **Install**, with no Terminal and no password: it runs Homebrew (or winget on Windows) for you when it's there, and otherwise fetches ffmpeg for Tidy Up alone, checks it's exactly the build expected before it runs, and keeps it in its own folder. A scan that stopped for want of it offers **Install ffmpeg**, then carries on by itself. Calibre's row opens its download page, and coming back to the window checks again without a click.
- **Tidy Up:** a screen for the libraries on the media drive. Music is matched, tagged into your 14 genres, and laid out as Artist/Album (Year)/01 Title on a hidden copy, swapped in with Navidrome paused and backed up, checked song by song, and only then is the old library put in the Trash. Books are reviewed in the app, before and after with their covers, each one yours to leave alone, then applied. Films and episodes in H.264, with lossless audio, or with other languages' tracks are shrunk through Tdarr to HEVC (or AV1), each checked before it replaces its original, its subtitles re-timed to the new copy. Audiobooks in dozens of MP3s become one .m4b each, with chapters and one cover. Every library's player is told about the one folder that changed, rather than scanning everything.
- **New downloads filed by themselves:** whatever finishes downloading in Downloads (and the download apps' folder) is filed into its library a few minutes later: episodes and season packs, anime numbered from its first episode, films, albums, audiobooks, and loose books, .zip files unpacked first. A duplicate is kept only when it is the leaner copy, a bloated film goes through Tdarr before it is filed, and what a download leaves behind goes to the Trash. Sonarr, Radarr, and Lidarr can hand their renaming and importing over to it in one click.
- **Lyrics that scroll:** time-synced lyrics from LRCLIB for every song, replacing plain ones when synced ones are found, instrumentals skipped; and a Navidrome smart playlist for each of your genres.
- **The nightly sweep:** at 03:00, posters, .nfo and subtitle files whose film, episode, song, or book is gone, and empty folders, go to the Trash.
- **Tidy Up waits its turn:** one job moves files at a time; while one does, the nightly update leaves the media apps for the next night and Duplicati waits, and the heavy jobs wait for power and pause when the laptop goes on battery. `homelab media` does it all from a terminal too, on a Mac, Windows (Docker Desktop, any drive letter), and Linux.
- **Type to find an app on Status:** start typing an app's name anywhere on Status and the list keeps only the apps that have it, in a box beside the list that says how many; Return opens the first one's page, and Escape brings every app back.
- **Type a command:** ⌘K (Ctrl+K on Windows and Linux) on any screen opens a box: type an app's name for its Open, page, Restart, Stop, or Logs, or *stop media*, *back up now*, *update all*, a screen, or *hide amounts*. The arrows pick and Return runs it; a stop asks for a second press, and Update all shows its list first, as their buttons do. On a Mac it is in View too.
- **Undo a stop:** after Stop, Stop all, or Stop for a while, a note at the bottom of the window says what stopped ("Stopped 6 Media apps") with **Undo**, which starts them again. It stays 10 seconds, and longer while your pointer is on it; ⌘Z (Ctrl+Z on Windows and Linux) undoes too.

### Improved

- **Add to Home Screen, done right:** the phone companion added to an iPhone's Home Screen has the app's icon, no longer a picture of the page, and Android's shapes no longer cut it. Opened from there, its splash on Android is the app's own background, and the bar above it follows light or dark mode.
- **Shapes as well as colours:** an app (or backup, or anything else) that is stopped or needs a look has a triangle beside it and one that is down a cross, where a running one has a circle, so a state reads without telling green from red, on a small screen, and in Windows' contrast themes.
- **An unplugged drive is waited for on Linux too:** with the media drive out when the machine started, Docker made an empty music, films, or photos folder where the drive goes and started the app on it, so it showed an empty library and the drive's place was taken. Those apps now wait for the drive and start within a minute of it being plugged in, as on a Mac and Windows; installing makes their folders on the drive instead.
- **After sleep:** when the computer wakes, every app is checked at once, not up to 15 minutes later: an app that went down while it slept is noticed (and restarted, or alerted about) straight away.
- **A drive comes back:** apps waiting for an unplugged drive start within a minute of it being plugged in again, not at the watchdog's next check up to 15 minutes later.
- **Starting and stopping an app, without the log:** Start, Stop, and Restart no longer open a dimmed panel of Docker's output (image downloads and all) to read and close. The app's row and its page say what is happening, *Downloading the app…* while it comes down first, and the row turns to Running or Stopped; Stop still offers Undo. If it fails, the row says why, with **Details** for what Docker said. Updates keep their panel, with what's new.
- **Lyrics for more songs, and why the rest have none:** a song LRCLIB lists under another album, another length, or a title like *Paranoid Android - 2009 Remaster* is now found by a search when its exact record isn't there, and a song with no album tag is looked up at all (it was skipped as an error). When it's done, the card says what came of every song: added, already time-synced, instrumental, not on LRCLIB yet, or no title tag. Songs LRCLIB has nothing for are asked about again a month later, so running it again is quick, and **Add lyrics** on Overview counts only the songs still worth asking about.
- **Tidy Up, redone:** Overview is one list of what needs your OK across every library, each line with what it wins back and its one button, so nothing is three clicks away; a ring of your music's genres; the media drive, what each library takes, and what is free; and what was done lately, with **Undo** on the music swap and the books' changes. Films, shows, and books have genre rings too, from Jellyfin or the films' .nfo files, and from Calibre's tags; a dropdown picks whose. A film or episode in the library twice is found by the scan and offered on Overview; **Remove extras…** keeps the copy with the best picture and puts the others in the Trash, after asking. TV says which episodes are missing from a season, by show. Films and shows Jellyfin has no poster for are named, and **Fetch posters** asks it to look again. Whatever Tidy Up puts in the Trash, its line in Recently done can put back with **Undo**. Each library has its own tab with what could be tidier, its space, and its history. New downloads and lyrics now live on Overview and Music.
- **Tidy Up, smoother:** each library's name on Overview opens its tab; a library whose drive is unplugged says so on its tab and runs nothing until it is back; every card's heading lines up; New downloads shows its six steps in two even rows; and the words read right (*Nothing went missing* in green, *1 download … before it's filed*, *English only* for the languages kept, *H.264* written one way, *Ready to review* for the books).
- **Finances on the phone, what is coming up first:** on a paired phone, Finances opens with **Coming up**: every bill of the next two weeks with its day and how soon (today's and tomorrow's in amber), a bill charged to a card marked with its card, and what leaves checking in all. Under it, the goals, each with what it needs a paycheck and **See all**; **Calendar** opens the whole month.
- **Finances, card charges on the calendar:** a bill you charge to a card moves no checking money, so the calendar left it out. It now shows on its day, marked with its card and the day that card is next paid ("on Chase Freedom, due Nov 21"), apart from what checking holds.
- **Finances, a sidebar balance opens its own group:** Cash, Investments, or another group's balance in the sidebar opens Net worth on that group alone: its total, each of its accounts month by month as a band of its own, and only its accounts listed. **Show everything** goes back to the whole page.
- **Finances, the calendar a year ahead:** past the three months it reads checking for, the calendar goes on to a year from today with each payday and payment on its day, so a yearly renewal shows in its month. Those days show what is planned, without a balance.
- **Status, tighter:** the short cards (Protection, What the apps keep, what is using power) stack in one column beside Recent alerts instead of one sitting alone beside a long list; an alert with a long list shows its first 3 lines and **Show N more**; and each app's size takes one line, its name, bar, and size side by side.
- **Keep using the app while a long job runs:** Update all apps now, an app's update, Fix it, and the other commands in a window of their own have **Hide** while they run; they carry on, with a small bar at the foot of the sidebar that brings them back and says when they're done.
- **Jobs wait their turn instead of failing:** pressing Back up now, a Setup step, Install, or an app's Start, Stop, or Restart while another job runs no longer says "another install or setup step is running". It waits its turn, says what it's waiting for where you pressed it, and starts by itself as soon as the one before ends. The other apps' buttons stay usable meanwhile.
- **Phones and the nightly jobs wait their turn too:** a Restart from a phone, the nightly backup and update, and the app's own jobs now queue behind each other rather than running at once or being refused, each saying what it is waiting for; and the watchdog leaves the apps alone while an update or backup is working on them.

### Fixed

- **Tidy Up starts again after a job was cut off:** a job stopped part way (the computer restarted or slept during the nightly sweep, or the app quit) could leave its lock behind under a number the computer later gave another program. Tidy Up then took the job for still running: the downloads, the nightly sweep, and the automatic jobs never ran, every job you started said another was moving files, and backups waited. A lock like that is now seen as left behind, and the next job takes over.
- **Tidy Up offers to set apart lyrics in two languages again:** songs whose lyrics run a translation after a caret on each line (*¡NUEVAYoL!^NEW YORK!*) are put right by adding lyrics, but once every song had lyrics, Overview offered nothing, so they stayed as they were. Checking lyrics now counts them, Overview offers **Tidy lyrics** for them, and a check from before this asks to be run again.
- **Tidy Up's logs and crash notes no longer pile up:** each Tidy Up job, its checks included, left a log that was never cleared, its background log grew without end, and the list of what went to the Trash kept every line forever. Job logs now go after 30 days, the background log is cut at 5 MB, what Undo can no longer reach leaves the Trash list, and crash notes go after 90 days.
- **Two jobs no longer save over each other's notes:** the nightly update, the watchdog, and a rollback each keep a note of what every app ran before its update, and one could save over what another had just noted (a rollback, or when an app came up well); a Setup step ticked in the app as Setup opened elsewhere could come undone. Each now keeps the other's change, and these records, with the household's and the restart counts, are written whole, only for this account.
- **The watchdog's, the battery saver's, and the savings records are never half written:** Status and the once-a-minute check could read one while it was being written and take it for empty, and two watchdog runs at once could save over each other. Each is now written whole, one writer at a time, and only this account can read it.
- **Pinning an app is never lost:** pinning one app from the app and another from a phone at about the same time could keep only one pin. The pinned apps now live in a record of their own that each change updates in turn, and they move there by themselves after the upgrade, still in the order you pinned them.
- **Turning an app's alerts off is never lost:** *Tell me if it stops*, switched from the app and a phone at about the same time, could keep only one of the two, since both rewrote the same line of the settings file. The list now lives in a record of its own that each change updates in turn, and it moves there by itself after the upgrade, with every app you had turned off still off.
- **Downloads wait out a busy registry:** when GitHub's or LinuxServer's image registry asked to space out downloads, installing several apps at once gave up after under a minute with *the image registry is spacing out downloads*, and a rebuild from the backups stopped at its first step. Downloads now wait and try again for a few minutes, and the rebuild downloads Duplicati before it starts it.
- **A genre count that finds nothing says why:** counting your films' or shows' genres with nothing to read them from said *0 films in 0 genres, from nowhere yet*, and the Genres card went back to its first question as if nothing had run. It now says why (Jellyfin's API key isn't set, with where to make one, and no .nfo files beside them), and the card says what it counted, with **Count again** and **Add Jellyfin's API key**, which opens Settings at that key on Jellyfin's page. *Couldn't tell Jellyfin* and *Couldn't tell Navidrome* say where their login goes too.
- **An update installed by hand counts:** after an update didn't go in place and you installed a newer release by hand, the app still said the update didn't install, and **Try again** stopped with *no update is ready*. A build as new as the one it was updating to, or newer, now counts as updated, and **Try again** with nothing newer simply closes the line.
- **Tidy Up signs in to Tdarr:** Tdarr now asks for an account, and **Set up Tdarr** stopped with *answered 401*. Tidy Up makes Tdarr's first account itself when it has none (its password kept in Settings › Tidy Up), or signs in with the one you made, from Settings › Tidy Up (Tdarr user and password); without one, it says where the login goes. And Tdarr now actually shrinks what it's handed: a new Tdarr's node has no worker, so everything sat in its queue. **Set up Tdarr**, **Shrink**, and **Collect** give a node with none one worker (on the graphics card when there is one), which you can raise on Tdarr's page. When Tdarr isn't running, Collect and Shrink say so (*start it from Status*) instead of *Something unexpected went wrong: … Connection refused*.
- **Tidy Up says why a job stopped:** when a scan couldn't start (ffmpeg not installed, say), it said only *exit status 1*, with the reason hidden under Show details. It now says the reason itself, the line is red in the details, and the fix names only your system's way to install ffmpeg (*brew install ffmpeg* on a Mac).
- **Tidy Up on Windows pauses the apps first:** with Docker Desktop, Navidrome and Calibre-Web kept running while your music or books moved, because Docker names `M:\music` another way. They're paused now, as on a Mac. And music is tidied with beets on this machine, since beets' container can't open Windows folders.
- **Tidy Up finds Calibre and ffmpeg on a Steam Deck:** Calibre from Discover (a Flatpak) or installed in your home folder, and ffmpeg from Homebrew or Nix, said *Not installed*. They're found now, and the books are tidied with them.
- **Tidy Up never replaces on a guess:** a download whose library copy couldn't be read replaced it unchecked, and another cut of a film (an extended one) was put in the Trash as a duplicate. Both are now left where they are for you to look at, and a second version kept on purpose (*Heat (1995) - Director's Cut*) is never counted as a duplicate. The nightly sweep keeps a film's *Subs* folder and its subtitles in other capitals, and a Firefox download still being written beside its empty placeholder waits.
- **Tidy Up's names work on every drive:** a film or show already in the library with its accent written the Mac way (*Amélie* copied from a Mac) got a second folder beside it on Linux and Windows; a long Chinese or Japanese title could be too long for a Mac's or Linux's drive, which count bytes; a title like *CON.Air* couldn't be made on Windows; and renaming *heat* to *Heat* on a Mac's or Windows' drive stopped with *already exists*. Names are now written one way, cut to fit in bytes, and kept clear of Windows' device names.
- **Tidy Up finds a library set through a link:** with a library's folder written as a link (a Media folder pointing at the drive) or a Windows short name, Jellyfin and Tdarr were told about the wrong path and a film Tdarr had shrunk could not be collected. Paths are now compared as they really are.
- **Tidy Up never deletes outright on a USB stick or network drive (Windows):** those drives keep no Recycle Bin, so what Tidy Up threw away there was gone for good. It now goes to a hidden `.tidy-trash` folder on the same drive, a folder a day, to restore from or empty yourself.
- **Tidy Up's cards have room again:** each library's card, the books' card, and a running job's card had their words and buttons pressed against the card's edge, and the row of numbers on Overview, Movies, TV, and Lyrics touched the cards under it. They now sit inside the card with the same margin as Status's, with a gap under the numbers.
- **A finished install can be closed:** on Choose stacks, the bar, each app's row, the details, and *Ready to open* stayed beside the plan until the next install. **Close** under *Ready to open* now puts them away.
- **An app update that did not go in place, on a Mac or Linux:** when the app was still open a minute after the update asked it to quit, the new build was put in place under it anyway, so opening it only brought the old one back, and the app said the update did not install without saying why. Now it asks the app to stop, as on Windows, and puts the update in place; one that still will not stop is left as it was, and the line says so. That line is red, as a failure, with **Try again** and **Download it** (the newest release), not only words saying to.
- **The update line on Settings is whole again:** Settings' header, which blurs what scrolls under it, also covered the lower half of *Homelab Wizard … is ready* and its buttons on a Mac (and in the Windows and Linux app). It now sits below the line.
- **An app you stop stays stopped, even at the same moment as another:** stopping an app from a phone while the computer was starting another again at its time could be forgotten, and the watchdog then started the app you had just stopped. The list of apps stopped on purpose is now changed one at a time, and never read half-written.
- **Undo in Tidy Up puts back only what is in the Trash:** a homelab moved in from someone else's file could have Undo put one of its files anywhere in your account, among the programs that start when you sign in included. Now Undo takes things only out of the Trash, where Tidy Up put them.
- **Time-synced lyrics for every song that has them:** some songs (*NUEVAYoL*, for one) showed one still block of words with a translation after a caret on each line (*¡NUEVAYoL!^NEW YORK!*) instead of lyrics that scroll. LRCLIB's record for the album had plain lyrics only, and Tidy Up took them without looking for the time-synced ones another record has; it now looks. A translation after each line's caret now gets a line of its own under the original, at the same moment, so both languages show as the song plays, and a song with a .lrc or .txt file beside it gets its lyrics there, since Navidrome reads that file before the song's own. Songs it gave up on are asked about again on the next run.
- **Tdarr gets every film:** **Shrink** handed Tdarr only the films the last scan had found, so a film Radarr filed since then was never shrunk. It reads the new ones first now. A film Tdarr has no record of a while after it was handed (Tdarr was restarting, say) is handed again, and after three tries it's named rather than waiting forever; a new download that was waiting for Tdarr is filed as it is then, so it doesn't stay hidden. A films library Tdarr's container can't open is named, with the folder it can, instead of being handed to Tdarr for nothing, and **Shrink** says when Tdarr's Tidy Up library is gone (run **Set up Tdarr** again).
- **Finances, smaller things:** on Transactions, a filter whose last transaction you deleted or changed showed *Every category* (or account, tag, month) while the list stayed empty; it now lets go. A form's Save that couldn't go through said why, rather than *Cancel again to drop it* when you had pressed Cancel first. The heading's *update them with Edit* now names the button: **Update balances**.

## [0.17.0] - 2026-11-02

**Apps you stop stay stopped, money hides at a keypress, and a right-click on any app.** Stop an app for good or for a while and nothing starts it behind your back; ⌘⇧H hides every amount, on your phones too, and a wall screen can show the next payday and bills; a right-click on an app on Status offers everything its page does. From this version each release is the next number (0.17.0, 0.17.1, … 0.17.10, then 0.18.0).

### New

- **Right-click an app on Status:** its row's own menu opens where you click, with Open, Open on a phone, Copy address, Start or Restart, Stop (it asks twice), Stop for a while, Logs, Back up now, and Tell me if it stops, without opening its page. Shift+F10 or the menu key opens it from the keyboard, and a right-click on a group's heading opens that group's menu.
- **The money card on a wall screen:** pick **Money card only** beside a paired screen in Settings › Phones, and its Status shows the next payday and who is paid, what checking holds once its bills are paid, and the next 3 bills, with their logos. The screen is sent only those few things, never your plan, and no amount at all while Finances hides them. A screen still pairs without Finances, as before.
- **Finances, hide amounts:** ⌘⇧H (Ctrl+Shift+H on Windows and Linux), View › Hide Amounts, or the eye on Finances and beside the sidebar's Accounts writes every amount as $•••, the sidebar's balances and the charts included, for a screenshot or a screen others can see. It is kept with your finances, so your phones hide them too, and it stays until you show them again. The forms you type in and the exports keep the numbers.
- **Stopped means stopped, and Stop for a while:** an app you stop from its group's menu or its page stays stopped: Start the N stopped, the watchdog, the battery saver, and apps waiting for a drive all leave it, and its row says *Stopped by you* with Start beside it. **Stop for a while** (on its page, or a group's menu for the whole group) stops it for an hour, until 9 PM tonight, or until 8 AM tomorrow, its row says until when, and it starts again by itself within a minute of then. Starting the homelab (at login too) and **Fix it** leave such an app stopped, with the apps that need it, and **Stop** on an app's page now asks for a second click, as a group's does. The record is kept in the homelab's data folder, so it survives a restart and is backed up.
- **Take the homelab off this machine, from the app:** Settings › This machine has it, with what else goes ticked: the apps' data, the homelab folder, the backups on this machine, Homelab Wizard itself, and everything else in the container runtime. **Review what goes…** shows the homelab's own plan, and nothing happens until `uninstall` (or `delete everything`) is typed. `homelab uninstall` has the same as `--folder`, `--backups`, `--app`, and `--everything-else`, on a Mac, Windows, and Linux. A backup folder in a cloud drive always stays, as deleting it would delete it on every machine signed in to the drive, and with the data gone the machine signs out of the tailnet, so it leaves Tailscale's admin console instead of keeping the homelab's name.
- **Finances, a money calendar:** a Calendar view lays out each month: who is paid on which day in their colour, each bill and card payment with its logo, bank holidays, paydays moved before a weekend or holiday, and checking at the end of each day, marked when it falls under your cushion. Pick a day to see what moves and what checking holds after; the arrow keys move day by day. On a phone it is a list of the days something happens, week by week.
- **Finances, subscriptions together:** Recurring › Subscriptions shows what they cost a month and a year, what renews in the next week and month, how many are paid yearly against monthly, and each one, dearest first, with its cost both ways and whether it is due today, tomorrow, in a few days, or was just paid. Each has a type (streaming, software, cloud and homelab, gaming, news, fitness, food, phone), suggested from its logo or name and yours to change, and the year's cost is split by type.
- **Finances, cards paid off with each paycheck:** tick "I pay it off in full with each paycheck" on a card and type about how much goes on it between paychecks. Each payday into checking, whoever is paid, pays its whole balance, counted in checking after the bills and in what each paycheck leaves, and a typical month counts the card's spending once. A payment can also come "With each paycheck, whoever is paid".
- **Finances, your own logo:** on any account or payment, "Use your own image" takes a picture file and shows it for that brand everywhere it appears (or for that name, with no brand). It is made small on your device and kept in the finances file, and Remove your image takes it out. Nothing is fetched from the internet.
- **The apps open at home with a VPN on:** with a Cloudflare token, **Set up the domain** also points every app's name at this machine's address at home in Cloudflare's DNS (one record, `*.your-domain`, not proxied). Phones and computers at home then find the apps whatever DNS they use, Proton VPN's or the router's, without changing each device's DNS; the VPN app needs *Allow LAN connections* on. The tunnel's public apps keep their own records, and outside your home the address leads nowhere. When the router gives this machine a new address, the watchdog moves the name, and AdGuard's, within 15 minutes.
- **Jellyfin and Navidrome accounts for each person, and Reset password:** with a Jellyfin API key and a Navidrome administrator's login in Settings (each with a **Test**), **Add a person** also makes their Jellyfin and Navidrome accounts, so Infuse, the TV apps and music apps such as Arpeggi sign in. One password for both is on their welcome page, with what to type in Infuse and a music app, and the homelab keeps it nowhere else. **Reset password** (Settings › People, or `homelab person password <name>`) gives them a new one on a fresh welcome page, with no PIN file or Terminal, and **Remove** turns those accounts off too. The welcome page no longer says there is no password to remember when there is.
- **beets, for a tidy music library:** beets joins Navidrome and Feishin in the Music pick in Choose stacks (or `./homelab install beets`). It matches music you add by hand against MusicBrainz, fixes the tags, adds covers and genres, and files each album as Artist/Album (Year) in the music folder, where Navidrome finds it at its next scan. Its library page is on this computer only, and its note shows how to import.
- **Finances, transactions:** a Transactions view keeps what actually happened: money out, money in, or moved between your own accounts, each with its payee and logo, day, account, category, the planned payment it pays, and a note, newest first by day, with this month's money in and out. Kept in its own file beside the plan and backed up with it; on your phones too, view only where they may only look.
- **Finances, budgets:** set how much a category may take a month or each paycheck, rolling over what is left if you like; Transactions shows each this month with what is left or how far over, a mark where an even pace would be by today, and a group's budget counting its own categories.
- **Finances, reports:** a Reports view reads your transactions over this month, last month, three months, this year, or all: money in and out, spending by category with each group's own under it (refunds taken off), where the money went by payee, and money in against out month by month, each chart with its numbers for a screen reader.
- **Finances, import a bank's file:** bring a CSV or an OFX/QFX statement from your bank's website into Transactions: it is read on your device, its columns guessed (and yours to change), US and European dates and amounts read, those already in skipped, and each payee given the category it had last. No bank connection, nothing sent anywhere.
- **Finances, recurring found:** Recurring lists what your transactions show you pay on a rhythm (weekly, every two weeks, monthly, quarterly, or yearly) that isn't in the plan yet, as in "Hulu, $17.99 monthly since Jun 3", and adds one to the plan with a click.
- **Finances, tags:** a transaction's tags show on its row; Transactions can show only one tag's, and Reports has a By tag card and a tag pick that narrows every report to it (what the road trip cost, say).
- **Finances, export:** Reports' Export CSV saves the stretch's transactions (a tag's, when one is picked) for a spreadsheet, where you choose on the computer, shared or downloaded on a phone. A split is a row per part, and the file is readable only by you.
- **Finances, a category's trend:** Reports draws a category's last twelve months, bar by bar, and says how this month so far compares with the same days a year before.
- **Finances, receipts:** a transaction keeps its receipt: a photo (on a phone, straight from the camera), made smaller on the device, or a PDF, shown in its form and marked Receipt in the list. Receipts stay on the homelab beside the transactions and go into the nightly backup with them; one removed goes a day later. On a phone allowed only to look, a transaction with a receipt opens it under its row.
- **Finances, accounts in other currencies:** an account can be kept in its own currency (a euro account, a UK pension), at a rate you type in; its balance and transactions stay in that currency, and Finances adds them up in yours. Nothing looks a rate up. Update balances asks for each in its own currency, Net worth shows both figures, and Pay › Paydays and money keeps the rates.
- **Finances, goals:** Net worth has Goals: an emergency fund, a trip, a car, each with how much, by when, and a share of the accounts that count toward it (it never moves money). Each says what is left, what it needs a month and a paycheck to be there in time, and, from how the accounts grew lately, when it gets there at that pace, in amber when that is late. When together they need more a month than the plan puts by, Goals says by how much; What if tries another amount a paycheck, or another day, without changing anything.
- **Finances, loans:** Net worth reads each loan to zero: what goes to it a month, the month it is paid off, and the interest still to pay at its rate, with the loan you pick charted to zero; in amber when the payment does not keep up with the interest or nothing goes to it, and listed apart once paid off. A card carrying a balance (a rate, and a payment into it) is read with them, and Pay more shows what an extra amount a paycheck does: to the loan you pick, and to all of them paid down the highest rate first or the smallest balance first.
- **Finances, money flow:** Recurring draws a typical month as it flows: each person's pay in, and out to each kind of bill, what is saved, and what is left over (or what comes out of the accounts when a month takes more than comes in), with every amount listed under it.
- **Finances, a car's worth over time:** give a car what it cost, when, and how well it holds its value, and Finances reads what it is worth today (most of the drop in its first year, less each year after, never below a tenth of its price) for net worth; a value you type in counts instead, and falls from that day.
- **Finances, financial independence:** Net worth estimates what would be enough to live on (a year's spending over the share drawn a year, 4% to start), what the investment and retirement accounts hold toward it, and the month it gets there at what you put by and growth after rising prices (5% to start), with two points either way. It says it is an estimate, not advice, and both assumptions are yours to change.
- **Finances, what your homelab does now:** Recurring lists the payments an app running on the homelab does the job of ("Jellyfin is running: Netflix still costs $185.88 a year"); Cancelled it takes one out of the plan and keeps it, and what those cancelled because of the homelab come to a year shows under them.
- **Finances, set aside for bills that come less often:** Pay lists the bills that come every three months or once a year, what each costs a year and needs from each paycheck to be there when it comes, and their total, with a button that adds a payment into savings for it with each paycheck (or brings it up to date when the bills change).
- **Finances, reminders:** the homelab's ntfy tells you about a bill or card due tomorrow, three days before a paycheck that will leave checking under your cushion, a week before a yearly payment renews, and each week the balances go without an update; each can be turned off in Pay › Paydays and money. The weekly summary ends with Finances too: what the next paycheck leaves, the biggest bills before it, and net worth with its change since last week.
- **Finances, a calendar feed:** Pay › Paydays and money makes a link your phone's calendar can subscribe to, with the paydays and bills ahead (and their amounts, if you like). It works over Tailscale or the homelab's own domain, never the home Wi-Fi; a new link, or Turn it off, stops the old one at once.
- **Finances, payees as you'd write them:** a bank's wording ("NETFLIX.COM", "AMZN MKTP US*2K4", "SQ *BLUE BOTTLE", "POS DEBIT SHELL OIL 57444 SAN JOSE CA") comes in from a bank's file as Netflix, Amazon, Blue Bottle, and Shell, with their logos and the category each had last; the bank's own wording is kept in the note. Transactions already kept as the bank wrote them show their logos too.
- **Finances, a payee's logo:** Change logo on a transaction picks one (or None) for its payee: every transaction to it shows it, and the next one, typed or brought in from a bank's file, takes it too.
- **Finances, a mark for every payee:** a payee with no brand's logo and no category's icon gets a mark of its own, its initials on a colour its name picks (Blue Bottle is the same BB every time), in Transactions, Reports, and a bank file's preview, where a plain letter was.
- **Finances, 39 more logos:** everyday chains show theirs, from a bank's wording too: Google, IKEA, Taco Bell, Burger King, H&M, Uniqlo, Lidl, Booking.com, Hotels.com, Shopify, and Waze as their marks, and Trader Joe's, Whole Foods, Chick-fil-A, Dunkin', Subway, Wendy's, Publix, Aldi, 7-Eleven, Domino's, Pizza Hut, Safeway, Panera, Dollar General, Gap, Old Navy, Nordstrom, Sephora, Petco, PetSmart, GameStop, Barnes & Noble, Wayfair, Dollar Tree, JetBlue, Tesco, Zara, and KFC as initials on their own colours.
- **Finances, balances from Firefly III:** Update balances has From Firefly III: on a click it reads the asset accounts' balances from Firefly III on this machine (with the importer's token), fills each matching account's box so the difference shows, and says which it could not match. Nothing changes until you Save.
- **Finances, subscriptions from Wallos:** while Wallos runs, Recurring has From Wallos: on a click it reads Wallos's subscriptions on this machine (with its API key, `WALLOS_API_KEY`) and lists those not in the plan yet, each with its logo, rhythm, next day, and type, to add one by one or all at once. Ones already in the plan, turned off, or on a rhythm Finances doesn't keep are named, not added, and Wallos isn't changed.
- **Finances, balances from Ghostfolio:** while Ghostfolio runs, Update balances has From Ghostfolio: on a click it signs in on this machine with your security token (`GHOSTFOLIO_SECURITY_TOKEN`), reads what each account is worth, and fills the boxes of the accounts with the same name and currency, for you to check and save. From Firefly III now shows only while Firefly III runs, and neither shows on a phone.

### Improved

- **A menu on each group in Status:** click a group's count ("Media · 7 running ✓ · 2.1 GB") for what its apps hold in memory now, each one's share biggest first, and Start, Restart, or Stop them all; Stop asks for a second click. "What's using power" also says how much memory the apps hold in all, so you can see what to stop when the container runtime is using a lot.
- **Your balances on every screen:** the sidebar's Accounts (each group's total and net worth) now shows whatever screen is open, not only Finances, and clicking a group opens Finances › Net worth.
- **Click outside to close:** a click on the dimmed screen around a panel (a command's progress, a log, a form) closes it, as its Close or Cancel would; a form with something typed asks first.
- **Finances, budgets to watch:** the Dashboard shows the budgets that are over, ahead of an even pace, or nearly spent; See all opens Transactions.
- **Finances, your own categories:** Transactions › Categories renames, regroups, adds, and deletes them, each with an icon; a rename follows on every transaction, and a category deleted leaves its transactions in its group.
- **Finances, categories:** transactions offer the household's categories as you type (Food › Groceries, Utilities › Electric, Subscriptions › Streaming and music…, ready-made until you change them), a payee you typed before brings its last category, and a transaction with no logo shows its category's icon.
- **Finances, paid:** Recurring says when a transaction paid each planned payment ("Paid Oct 23"), and when it was not what was planned, by how much ("$15.00 more than planned").
- **Finances, balances follow what happened:** a transaction dated after you last typed in an account's balance moves that balance, and one that pays a planned payment takes that payment's place, so a bill paid early is not taken twice and one paid for more counts what it really came to.
- **Finances, splits and tags:** split a transaction across categories (Costco: groceries and home), with what is left to place as you type, and tag it ("vacation", "tax-deductible"); search and the category filter find both.
- **Finances, finding a transaction:** search Transactions by payee, category, note, or tag, and narrow them to an account, a category, a month, or money in or out, with the total of what shows.
- **Finances, a payment's category from its logo:** typing a new payment's name picks its logo and brings it into view in the list, and its category follows (Netflix a subscription, Verizon a utility, Toyota the car, Costco spending) until you pick one.
- **Finances, renewing soon:** the Dashboard lists the subscriptions that renew in the next week, soonest first, with what they come to; See all opens Recurring's Subscriptions.
- **Finances, collectibles on the Dashboard:** the pay period card shows your collectibles as one Collectibles tile beside the accounts; they are in the sidebar's Collectibles and in net worth.
- **Connect apps does the rest of the media apps' setup:** Sonarr, Radarr, and Lidarr get their library folders on the media drive (`/tv`, `/movies`, `/music`), Bazarr fetches subtitles for Sonarr and Radarr, and Seerr sends requests to them (HD-1080p, into `/tv` and `/movies`) once you have signed in to Seerr with Jellyfin. Running it again corrects an address or key that changed and adds nothing twice. What is left is yours: each app's login, your indexers in Prowlarr, Seerr's Jellyfin sign-in, and Bazarr's languages and providers.
- **Finances, fewer groups:** a brokerage, a Roth or traditional IRA, and a 401(k) are all under Investments (no separate Retirement), and Home and car is written Home & Car.
- **Finances, logos that read:** every logo and icon is the same size and centred, and every row's name starts at the same place, logo or not, a paycheck's person too. Logos that were tiny words at row size (Amex, Wells Fargo, Discover, Venmo, Delta, Uber, Ford, Jeep, Zoom, and more) are now their initials on the brand's colour, and three-letter initials are larger.
- **Finances, 296 logos:** 73 more from simple-icons (Steam, Spectrum, Zelle, airlines, hotels, VPNs, and more) and initials on the brand's colour for 77 it has no mark for (GEICO, State Farm, Allstate, Rocket Mortgage, Marcus, Betterment, PG&E, Adobe…). Fidelity, Vanguard, Schwab, Capital One, Citi, USAA, and the other picture logos are now clean initials on the brand's colour too. A brand that is also an everyday word (Delta, Box, Square) shows only for a name that is the brand itself, so Delta Dental gets no airline's logo.
- **Finances, an account's logo from its name:** adding or changing an account picks its logo as you type the name ("Chase Checking" is Chase, "Fidelity 401(k)" Fidelity, BofA, Amex), and a car's from its model ("Mazda 3", "CX-5", "F-150", "RAV4"), until you pick one; None picked by hand stays None.
- **Finances, Update balances in one place:** an Update balances button at the top of Finances opens one panel with every account, each box already at what it should hold today; as you type, it shows the difference, and Enter saves them all as today's (with the cushion that flags checking). Net worth's account table opens the same panel.
- **Finances, what you put by:** in Recurring, savings, a Roth IRA, or any account a payment goes into shows its balance today and after the paycheck that pays it next ("BofA Savings: $6,500.00 today, $6,712.22 after Nov 19").
- **Finances, one pay period at a time:** the Dashboard opens on one card for the pay period, "Alex's paycheck · Fri, Nov 6" with its days; ‹ and › step between paychecks and Today comes back. Under it your accounts sit side by side as they stand after its bills, with the change, the cards together in one tile, and an account money goes into that period lit ("$250 in"). Cash flow's paycheck bars and the grid of every account by paycheck leave the Dashboard; the grid is under Net worth.
- **Recent alerts drops what has cleared:** a watchdog alert goes once a later run passes every check it named, and a backup's "not running, so it was not backed up" goes once each app it skipped runs again, on Status, the phone, and the menu bar. **Check again** on the card reads them now instead of at the next minute. Other alerts stay their 12 hours, as before.
- **Finances, the homelab's own bills by logo:** Plex Pass, Tailscale, Cloudflare, Hetzner, DigitalOcean, AWS, Namecheap, Porkbun, Bitwarden, Mullvad, GitHub, Docker, Synology, Twitch, and Discord, 146 logos in all, each found from the payment's name as you type it. Sixteen marks that were faint on their colour (Claude, YouTube, Venmo, iCloud, AT&T, and others) are drawn in dark ink, so every logo reads clearly.
- **Finances, a bill without a logo:** shows what it is for, from its name: a drop for water, a shield for insurance, Wi-Fi for internet, a cart for groceries, a screen for streaming, a dumbbell for the gym, and more, not the same icon for every bill of its kind. Pointing at a day on the checking line shows each payment's logo and each paycheck's person.

### Fixed

- A group's menu on Status near the bottom of the list was cut off at the card's edge, and opening a second group's menu left the first open. Each menu now shows whole (upward when there is no room below), and one opens at a time.
- Apps paused on battery start again within a minute of plugging in, instead of waiting up to 15 minutes, and one app that would not start no longer keeps all the others stuck on "Paused on battery".
- **A Mac update that stopped part way no longer blocks the next one:** "The update stopped … resource busy" came back on every Try again, from the update's download left open; the update now closes it first.
- `homelab uninstall` leaves nothing of the homelab in Docker: it also removes the copies kept to undo an update (`homelab-rollback/…`), the backup's helper image (`homelab/sqlite`), and containers (with `--data`, volumes) of a homelab project no compose file lists any more. Containers that are not the homelab's stay, and it names them.
- **A wall screen names each group of apps:** in kiosk mode, Status's groups said only "4 running ✓", since their names sat on the buttons a wall screen hides; each now says which it is (Network, Security…).
- **The first run, in each system's own words:** with no Docker yet, Windows is told to run the installer and a Steam Deck to start the homelab and then press Set up Docker for me, instead of both being told to drag it to Applications, as on a Mac.
- **The welcome page on a phone:** a Jellyfin or Navidrome password stays on one line, so a hyphen is never read as part of a break, and the page no longer slides sideways on a phone; each app's details sit under its name there.
- **Explain this keeps your secrets home:** before an app's log goes to the model (on another computer, with `OLLAMA_HOST`), every password and key from Settings is taken out of it, not only what looks like one.
- **Your own DNS record stays yours:** Set up the domain no longer points a `*` record you made by hand in Cloudflare (for a NAS or another machine at home) at this machine; only one the homelab made, or one already pointing here, is moved.
- **Pairing a phone says when it will only look:** with no https link yet (no domain or Tailscale), a phone pairs over the home Wi-Fi and can only look, without Finances; picking more for it now says so, and how to give it more, instead of quietly pairing it look-only.
- **A command that fails says why:** when something you start in the app fails (a backup, a fix, a step of Setup), the red line now says what went wrong in the homelab's own words, such as "Docker is not running", instead of "exit status 1".
- **Reports and phones' logs keep every secret out:** two passwords the homelab makes for Homebox and Ghostfolio could show in a diagnostics report or an app's log on a phone, since their names don't say they are secret; they are taken out now, like the rest.
- **Starting Jellyfin on Linux says what to do:** if the password prompt is closed, the app now says to press Start again and enter it, instead of "exit status 126 Error executing command as another user"; other failures give the service's own reason.
- **After making the homelab, Setup says what comes next:** with no apps yet, it now points to Choose stacks to pick the first ones, instead of leaving only a checklist that never mentions them.
- **A Setup step that fails stays marked:** the step itself now says why it did not work and to press its button again once that is put right, instead of the reason going away with the red line after a few seconds.
- **The first run, one thing at a time:** before your homelab is made, Setup shows only what comes first (starting Docker, making the homelab) and says the rest follows; it no longer lists steps, offers to do them, or counts them in the sidebar while none of them could run yet.
- **Finances, something else or collectibles:** an account named "Ring" (jewelry) no longer shows a doorbell company's logo; only banks, cards, investments, homes, and cars take a logo from their name.
- **Finances, a box ticked with the mouse:** "The amount changes each time" on a payment now stays ticked when clicked or tapped; it unticked itself at once.
- **Finances, logos by name:** a payment or account with no logo picked shows the brand in its name ("Claude Pro" shows Claude's, "AMC A-List" AMC's), and the payment form fills the logo in as you type the name. AMC Theatres joins the logos.
- **Finances, a yearly payment's next day:** one that just came (Claude Pro, yearly on Oct 23) shows its day next year and how far off it is, not "Not in the next year".
- **On Linux, Ollama is no longer open to the whole home network:** Setup, doctor, and Open WebUI's note now have it listen on Docker's own address (`172.17.0.1`), which the apps reach and other devices do not, instead of `0.0.0.0`; Explain this and the checks find it there. Ollama has no password, so before, anyone on the Wi-Fi could use it. On SteamOS it stays as it was, as its note says.
- **The phone after pairing:** Status no longer shows a red "not on the phone: use Homelab Wizard on the computer". The phone asked the computer for Setup's steps and other things only the desktop app has; it asks for none of them now. A phone paired with a computer on 0.14.9 or earlier gets Status and its cards there too, rather than "Status is not available".

## [0.16.0] - 2026-10-31

**Finances, redrawn, on your phones, and by your own banks' logos.** A dashboard of cards for the household's money; net worth over time, a home and car as their equity; collectibles; your partner's phone allowed to look or to change; adding an account by its kind and its bank's logo, from 130; and the Windows update that went round in a loop, fixed.

### New

- **Finances:** a new screen in the sidebar for the household's money, typed in by hand and kept on this machine (its file goes off-site with the nightly backup, encrypted). Enter who gets paid and when, your accounts and cards, and the payments that repeat; it shows checking after each paycheck, which paycheck covers each bill, every account today and post-pay, paydays moved before weekends and bank holidays (US or UK, or weekends only), and net worth with your home's and car's equity. Amounts are in your currency, typed either way (1,234.56 or 1.234,56).
- **Finances on your phones:** pick, phone by phone in Settings › Phones, whether it sees Finances or can change them too (off for every phone until you do). Your partner's phone pairs the same way; a phone that may only look shows every view with no Edit. Finances go only to phones paired with the https link and never to a wall screen, and a change saved on one device after another's is refused with the latest shown, so neither undoes the other.
- **Finances, redrawn:** a dashboard of cards: checking over the next month (paydays and big bills marked, your cushion dashed, each day's money on hover), the paycheck picked with its payments, cash flow (its bars pick the paycheck), where the spending goes, net worth's trend, and every account after each paycheck. Recurring sums up a typical month, Pay draws each person's pay and where it goes, and the sidebar shows each group's balance under Finances. A row opens its form when clicked, so lists have no Edit buttons. **Collectibles** (trading cards, jewelry, art) are a kind of account of their own, worth what you type in and a group in Net worth; something typed in as Other can be made collectibles. **Adding an account** asks what kind first (Cash, Credit, Investing, What you own, each with what it is for), then its bank or broker by its logo, searchable, the account named after it when no name is typed. New logos, 130 in all: Fidelity, Vanguard, Charles Schwab, E*TRADE, Capital One, Citi, U.S. Bank, SoFi, USAA, Navy Federal, PayPal, Venmo, Cash App, Coinbase, Revolut, Wise, and bills from Disney+, Hulu, Peacock, iCloud, T-Mobile, AT&T, Xfinity, Progressive, Costco, and more (from simple-icons, CC0, and selfh.st/icons, CC BY 4.0); a bank in neither stands as its initials on its colour.
- **Rebuild a lost machine in one command:** `./homelab rebuild <backup folder>` brings the homelab back from Duplicati's backups alone, on a new machine: it asks for the Secrets passphrase (from the recovery kit), restores the settings, the household, the apps' data, and the databases, starts each app on the version that wrote its data, and makes the backup jobs again. It was about ten steps in Duplicati's own window. Every night it rebuilds a wiped machine against real Docker and checks each app's data.

### Improved

- **Finances, net worth over time:** each balance you type in is kept by its day, so Net worth draws month by month what you own stacked above zero (a home or car as its equity, less its loan) and the rest of what you owe below it, net worth's line through them, with or without the home and car so cash and savings show at their own scale, over three months, six, a year, or everything kept, and on past today, faded, to what the next paychecks leave. What you own and owe is listed account by account, largest first, each with its change and how long ago it was typed in.
- **Finances, account by account:** the dashboard shows every account (checking, savings, a Roth IRA, a brokerage, the cards) today and post-pay after each of the next six paychecks, once the bills are paid, with what each changed by; pick a column to see that paycheck. **Update balances** types today's in right there, each box starting at what is expected and saying how far off what you type is; Enter keeps them. A payment can come **with each of someone's paychecks** (a transfer to savings), on the days they are actually paid.
- **Each app's version, kept:** `.env` keeps the version each app runs (`<APP>_DIGEST`), written by the nightly update and a rollback; starting the homelab, a move, and a rebuild bring back those versions, so a restore never opens your data with a newer app than the one that wrote it.
- **The phone companion, for fingers:** Open and the other buttons are 36 px tall, the chevron to an app's page and a category's fold 40 px, the switches an iPhone's own size, and "‹ Status" a taller target. Open was 25 px and a switch 32×19.
- On a Mac, the menu bar's View menu lists **Finances** (⌘6), beside the other screens.
- **Status's cards read once for the window and the phone:** the background agent reads the watchdog, the alerts, storage, what's using power, this week, and protection, and the window and the phone companion get them from it, each still drawn the moment it is read; opened together, they no longer each ask the apps. Without the agent each reads them itself, as before.

### Fixed

- In Finances, a bank's or brand's logo sat a few pixels right of the icons and people's initials, with a wider gap before its name, so rows with a logo didn't line up with the rest (it took the margins of the app's name in the sidebar). Every logo, icon, and initial now starts at the same place, and so do the names after them.
- **The watchdog said the CrowdSec bouncer had stopped pulling bans** days after the proxy was updated, while it was still pulling them: CrowdSec records a proxy that comes back with a new address under a second name, and the watchdog only read the first. It now reads both, and **Fix it** removes both when it reconnects the proxy.
- Recent alerts on Status ran an alert's lines together ("…was not backed up komga is not running…"). Each line now shows on its own.
- Finances' forms (a payment, a paycheck, an account) opened on their Cancel button, so in a small window they opened scrolled down, with no title and no name field in sight. A form now opens at its top with the cursor in its first field; a command's sheet keeps the focus as before.
- In a contrast theme, Finances' bars showed only their filled part: net worth's owed part, the equity bars and the paychecks' meters had no track, and a balance running low before payday lost its warning colour. Each track is now outlined, the fill in the highlight colour, and a low balance hatched, as on the other screens.
- Deleting an account in Finances quietly moved the payments that used it to checking: deleting a savings account made its $200 transfer a $200 bill out of checking. Delete now names what uses the account and asks: delete them with it, or keep them.
- Finances took each loan payment whole off what is owed, so a $287,400 mortgage at 6.5% read about $20,000 lower a year on than it would be. A loan (and a card that carries a balance) can now have its interest rate, and is charged it a day at a time: a payment pays the interest first. A card paid in full each time is charged none.
- Finances had no way to say a bill goes on a card: a subscription billed to the Amex had to come out of checking, and the Amex's payment, which pays it, counted it again. A payment can now be **charged to** a card: the card owes it, and checking pays it with the card. A card's payment pays what the card owes that day, and its amount is now the card's other spending, built up a day at a time between payments, so a paid-off card no longer reads $0.00 owed while $900 a month goes to it.
- Finances counted saving as spending: Recurring's "Out, a month" took in what went to savings and a Roth IRA, so the example household had $1,156.85 left and "84% of pay goes out" when 10% of it was being saved. Recurring now shows **Spent**, **Saved** (with what a 401(k) keeps before the pay), and **Left**, and each paycheck shows what it spends and what it saves. Payments between other accounts, and money moved into checking, are no longer counted as going out of pay. The **Saving** filter no longer shows groceries; they have a **Spending** filter of their own.
- Finances read forward from today with the balances as you last typed them in, so a paycheck or a bill between that day and today was left out: balances typed in on the 20th, a $2,000 paycheck on the 23rd and $1,500 rent on the 25th, and on the 30th checking read $3,000 instead of $3,500. Each balance is now read from the day it was typed in: what is dated after it counts, and a new **Taken as done** list shows it, with **Not yet** for one that hasn't happened (it comes today). A bill dated the day you typed the balances in now counts as in them, as a paycheck did; **Not yet** is there for both. The warning that balances are a week old goes by checking's and the cards' own days, so updating them one at a time from Net worth counts, and renaming an account no longer marks its balance as new. Save in Accounts takes every balance shown as today's, starting from today's estimate.
- Finances: money moved from savings into checking now comes in. A payment set to go into checking added to the balance at the end of a paycheck, but not to its list, its totals, or the chart, so the numbers didn't add up; it now has its own "+" line, a **Moved in** total, and its step on the chart. A paycheck that goes straight into savings no longer splits checking's stretch with a "+$0.00" paycheck of its own; Pay lists it, saying where it goes. A payment twice a month on the same day twice ("the 15th and the 15th") was paid twice; the form now asks for another day.
- **Updating on Windows** went round in a loop for some: the update downloaded, the app closed and opened again, and it was still the old version, because Windows (SmartScreen, or Smart App Control) blocked the new unsigned installer that the update ran as an administrator. The update now puts the new files in place with Windows' own PowerShell (asking for an administrator's approval only when the app is in Program Files), as it already did for the portable copy. On every system, an update that does not go in place now says so and why, with the release page to install it by hand, instead of offering the same update again; each attempt's steps are kept in `update.log`.
- Finances' Accounts and Liabilities cards, next to Payments and Accounts, crushed their rows in a window under about 1,300 px, or at big text in any window: a line under a name wrapped a letter per line, balances overlapped the names, and the page slid sideways. Finances now goes by its own width, as the other screens do: its two columns stack until the narrower can have 440 px, and in the smallest window at big text its rows, notes and filters wrap.
- Status counted with brackets: "3 baseline app(s) down" and "7 other container(s) on this machine are not catalog apps". It now says "3 baseline apps are down" ("1 baseline app is down") and "7 other containers on this machine aren't catalog apps".
- In the narrow sidebar of icons, a screen's count on the Mac and Linux was see-through, so a two-digit count sank into its icon ("16" read as "6"). It is now solid, with a thin outline, on top of the icon's corner.
- **Find the apps on this Mac** asks for the Mac's password in a window again, instead of stopping with *making /etc/resolver with sudo: exit status 1*; on Linux, the steps that need the administrator's password (setting up Docker, letting the homelab keep the computer awake) ask in a window too, when started from the app.
- The phone companion zoomed in by its browser (150% and more) cut off Backups' values ("7 hours …", "Proton …"), Status's savings line, an app's state and the group headings, and slid sideways. Under 300 px the cards now go one per row and all of these wrap; a phone at its normal size keeps two cards per row.
- On a computer set to another language, an app's page and the Backups, Status and Setup screens wrote dates half in that language ("Missed checks on Dienstag", "Restore test passed 18. Okt."). Dates are now in English words, in the computer's own order and clock: "18 Oct, 15:25" in most places, "Oct 18, 3:25 PM" where months come first.
- On a monitor wider than a screen, each screen now sits in the middle of the space beside the sidebar; it was against the sidebar with the right side empty.
- Status's **More…** menu now takes the keys every menu does: Down (or Enter) opens it on its first item, Up and Down move through the items, and Escape closes it back on More…. It used to stay open over the cards after the focus had moved on; it now closes when the focus leaves it.
- Tab walked out of an open sheet (Update all apps, Fix it, an app's log) to the sidebar and the buttons behind the dimming. It now goes round the sheet's own controls, and Shift+Tab the other way.
- In a contrast theme, the sidebar marked the current screen with the same outline as the keyboard's focus, so the focus could not be told from it. The current screen now has a bar in the highlight colour at its left edge, and only the focus is outlined.
- In a Windows contrast theme, a switch (an app's Nightly updates and Tell me if it stops, and Settings' switches) looked the same on and off: its knob was the colour of its track. It now takes the theme's colours, outlined when off and in the highlight colour, knob to the right, when on.

## [0.15.0] - 2026-10-29

**Docker's own API, and a Status that keeps itself current.** The homelab reads the containers and runs commands in them through Docker's API instead of starting a docker command each time; the background agent runs the nightly updates in place of Watchtower and sends each change with the Status read after it, so every screen and the menu bar item stay current without asking; Status opens in one request; updates find themselves; and every screen fits big text in a small window.

### New

- **Updates find themselves, and take one step:** no more **Check again** or Restart to see one. The app looks for the homelab files and its own build together every 15 minutes (by the clock, so a Mac that slept looks again soon after it wakes) and whenever you bring its window forward, and downloads what it finds. One line at the top of every screen says *Homelab Wizard 0.15.0 is ready* with **What's new**, **Later**, and **Update now**, which puts the files and the app in place and opens it again on the same screen: *Updating…* with a bar, then *Updated to 0.15.0*. When it cannot finish by itself, the line says why in one sentence. The menu bar item's *Update to 0.15.0* does the same, with the window closed too. Setup's update card, the separate Restart banner, and the update's log are gone; installing on quit is on unless turned off, in Settings › This Mac › Updates with **Look now**.
- **Setup only while something needs you:** once every step is done, Setup leaves the sidebar, and comes back by itself (with a count) when a step comes undone; ⌘4 (Ctrl+4) opens it any time. Unplugging a laptop does not count as undone: its step is done while keeping it awake is on, and Status says when it is on battery. The machine's details and **Make a diagnostics report** moved to **Settings › This Mac**.
- **How this machine looks after the homelab:** four tiles on Setup, and one line at the top of Status: the background agent (running, or stopped, with **Start it**), the container runtime, the power (on battery, plugged in, kept awake), and the room on its disk.

### Improved

- **Status follows the agent, nothing asked:** when a container starts, stops, or changes health, the background agent reads Status once and sends it with the change, so the window draws it on whichever screen is open, and the menu bar item too, with no request of their own; switching to Status shows it at once. When the agent restarts, or goes away, the window and the menu bar item read it again at once rather than within the minute. Without the agent the window reads it again, as before.
- **Status opens in one request, its cards filling in as each is read:** the watchdog, the recent alerts, storage, what's using power, this week, and protection come back with Status in one answer rather than about nine requests, each drawn the moment it is read, so a slow one (the weekly summary asks several apps) no longer holds up the rest. The phone companion gets the same answer, a card at a time.
- **Status reads the containers straight from the engine (0.15's first step):** the containers, their events, what they use, and the engine's info come from its API over its socket (Docker Desktop's named pipe on Windows), found as the docker CLI finds it, one request on a kept connection rather than a docker command started each time; the docker command answers whenever the API fails, and `homelab doctor` says which is in use. `DOCKER_API=off` keeps the docker command. Commands run inside the apps (the nightly database copies, CrowdSec's) go through the API too, failing in the same words as before. Starting and updating apps is still `docker compose`.
- **Watchtower is gone; the background agent runs the nightly updates.** At the same time as before (4:00), each app with a newer image is copied first (its databases dumped, its folders and volumes kept), so a rollback puts its data back too, the watchdog's included. No container holds Docker's socket to change it any more. Starting the homelab removes Watchtower's container and image, the apps lose their Watchtower labels (an app updates nightly unless it is pinned, a database, or built here), and a custom app is made without one. A stopped app's **Nightly updates** can be switched off now too. The phone still gets the summary on the `watchtower` topic.
- **Settings, organized:** the page list in groups (this machine, the household, reaching the apps), the installed apps folded by their category as on Status, and the apps you don't have folded at the end; a search opens the folds with matches. Each setting shows its name in words, with its `.env` name on hover and while searching, a switch beside its name, and help without the commands behind it or a switch's true and false.
- **Setup, redesigned:** the first-time checklist is now **Finish setting up**, one line a step grouped as Needs you, Can wait, and Done (each step opens for the rest of what it says), with **Do the N I can do for you**.
- **Backups, tidied:** each app's database copy is one line (when, size, how many are kept), grouped as Stale, Up to date, Paused, and Not copied yet; the Off-site tile names the place (Proton Drive, the Backup drive) rather than "Set"; the off-site jobs' sizes read as the app's other sizes (3.3 GB, not 3.311 GiB), with when each runs next; and the vault export, moving to a new machine, and how the backups work are one line each that opens for the rest. **Test a restore** moved into its tile.
- **Big text in a small window:** when the window has little room for the text size you picked (text size 1.5 or larger in a small window), the sidebar shows only its icons, with each screen's count on its icon and its name on hover. A screen's toolbar keeps its buttons on one line, summary tiles stack one under another, and Setup puts a step's buttons under its words. At text size 2 in the smallest window, no screen scrolls sideways or cuts anything off.
- **A homelab with no apps yet:** Status shows one card, *No apps yet*, with **Choose stacks**, instead of tiles counting 0 of 0 over an empty list. Backups says *None yet* for the database copies before the first night.
- **The phone companion's app list:** each app's address has a line of its own under its state, instead of squeezing beside it into a narrow column; Open and the chevron stay beside the app's name.
- **Settings at a big text size:** when the screen is too narrow for Settings' page list beside the page (text size 1.5 or larger in a small window), one **Page** drop-down takes its place, grouped as the list is, instead of the list wrapping into rows a screen tall above the page.

### Fixed

- A long search without spaces (a pasted word or link) no longer pushes Choose stacks sideways: *No app matches …* wraps.
- At a big text size, the sheets (Update apps, Open on a phone, an action that failed) were wider than the window and cut off on both sides, hiding their buttons; they now fit the window at any text size.
- At text size 1.5 or larger in a small window, the line that says a new version is ready cut off **Later** and **Update now**; they now go on a second line.
- Choose stacks' plan, Status' paired cards, an app page's two columns and each setting's name beside its field now depend on the room the screen has at the text size, not on the window's width: at text size 2 in a big window, Choose stacks' list was 84 px wide beside its plan.
- Backups' restore test tile said *Never* above *Proven in the last 30 days* before the first backup; it now says a test comes once there is a backup to test.
- In a Windows contrast theme, an app's **This week** bars showed every day the same, so a day with missed checks could not be told apart: a good day is now solid and a day with missed checks hatched in the theme's highlight colour.
- An app's page with a long name or a long address (a deep subdomain on your own domain) no longer scrolls sideways or cuts the address short: the address wraps after its dots, as on Status, and the title and **Remove** wrap too.
- Setup's Cloudflare API token step said what Cloudflare answered with the request it answered ("cloudflare GET /zones?name=…: Invalid access token"); it now says Cloudflare does not accept the token, why, and what a new one needs.
- An app stopped because its drive is unplugged (the Hobbies drive) no longer shows its database copy as red Stale on Backups, nor counts it as a problem: the copy is *Paused*, with which drive it waits for, and its last copies are kept. The weekly summary says so too. When Duplicati itself waits for that drive, its jobs' card says so, not "dial tcp 127.0.0.1:8200: connect: connection refused".
- The household, the paired phones, and the apps' single sign-on settings are now in the nightly backup: they lived beside the apps' data, where no backup job looked, so a rebuild from the backups lost them. The encrypted Secrets job takes them off-site with the settings file, and the recovery kit says where they go back.
- Nextcloud no longer takes the phone companion's port (8099): an install never hands a container the port of an app that runs on the computer itself, and a new homelab starts Nextcloud on 8089.

## [0.14.0] - 2026-10-29

**A frontend that grows, and a Mac that feels finished.** Status opens at once on the last reading, a click answers at once, and every screen is built from shared parts. Each app has its own page, with its icon, its log explained, its updates, and its settings. Quit stops everything, Keep this Mac awake is in the menu, and the menu bar item's menu is redesigned; the window fits a narrow screen.

### New

- **Settings › Appearance › Motion and Transparency:** Motion (Like the system, Less, None) stops what slides, spins, or grows (Less) or every animation (None), the progress bars and switches included; Transparency Off draws the side panel, the save bar, and the phone's bar solid, with no blur behind them. Like the system follows the system's own reduce motion and reduce transparency.
- **Quit stops everything, after one question:** quitting Homelab Wizard (⌘Q or the window's close button on a Mac, Alt+F4 or closing the window on Windows and Linux, or Quit Homelab Wizard… in the menu bar item or tray icon) asks "Quit Homelab Wizard and stop the homelab?". Quit and Stop stops every app, the background agent, and the menu bar item or tray icon; opening Homelab Wizard again, or the next login, starts them all. `homelab quit` and `homelab resume` do the same from a terminal.
- **Keep this Mac awake, where you can see it:** the menu bar item's menu (the tray icon's on Windows and Linux) has **Keep this Mac awake while plugged in** (this PC, this computer), ticked while the homelab keeps the machine from sleeping on power, which it does unless you turn it off. A click turns it off or on, and the background agent follows within a minute. Setup says it too: *This Mac stays awake*, with where to turn it off.
- **An app's page:** the chevron at the end of an app's row on Status opens everything about it in one place: its state with Restart and Stop (or Start), Open on a phone, and Open; its address with Copy and who can reach it; what it uses now (memory, processor, and what it keeps on disk); its week as seven bars, one a day, from the watchdog's checks; its last backup and restore test; its log, with warnings and errors tinted, more of it on request, and **Explain this** when Ollama runs here; its last update with **Roll back**, and **Check for an update**; and who in the household uses it. Its tile shows the app's own icon, asked of the app on this machine once a week (its first letter when it has none). Drawn in each system's own style, and in one column on a phone.
- **An app's own settings, on its page:** **Nightly updates** (off holds its updates, as `homelab updates hold` does) and **Tell me if it stops** (off: the watchdog still checks it and Status still shows it, but no alert is sent; `homelab notify off <app>`, and `on` again) as switches that change at once, and what the nightly backup keeps of it. **Remove** backs the app up first, then takes its container away; its data stays, so Choose stacks can bring it back.

### Improved

- **Status rows are simpler:** each has one button, Open (or Start when it is stopped), and a click anywhere on the row opens the app's page, where Restart, Stop, Update, Roll back, its log, and its sign-in now live. The log sheet is gone: the page's log has Explain this and Dozzle.
- On a Mac with macOS 13 or later, the background agent is the app's own login item (SMAppService), so System Settings › Login Items should list it as Homelab Wizard instead of a bare "homelab". Where macOS refuses or waits for approval, the app keeps the launchd job as before.
- **The menu bar item's menu (the tray icon's on Windows and Linux), as in the new design:** how many apps run, beside a coloured dot (a click opens Status), then how many need a look and when it was checked, then only what needs you, each line with its mark so they line up: an orange dot for each app restarting, unwell, not answering, or not running (named), the watchdog's failing checks (how many; the names are in the line's tooltip), and the newest alert; a tick for the last backup ("Backed up at 3:12 this morning", an orange dot once it is late); an arrow when updates are ready. Open an app lists your apps under their categories, each with a dot for its state, stopped ones too, and ends with Every app.
- Start, Stop, Restart, Update, and Roll back change their row the moment you click ("Restarting…"), and keep it until the app is confirmed; if the action fails, the row goes back as it was and says why underneath.
- Status opens at once on the apps as the background agent last saw them, marked "As it was a few seconds ago; checking now…", instead of an empty screen while Docker answers; the fresh state replaces it moments later. The phone companion does the same.
- Going back to a screen shows it at once, as it was: the app keeps each screen's data and reads it again only when the engine says it changed or it is over a minute old (⌘R, or Ctrl+R and F5 on Windows and Linux, reads it now). Opening and folding Status's categories asks nothing, and Settings keeps what you typed while you look at another screen.
- Install, Fix it, Update and the other jobs show a row per app saying what's happening ("Downloading · 54%", "Starting").

### Fixed

- After an update (or any job on Setup) finished, its bar and its row per app stayed on Setup with nothing to take them off. Once a job ends they stay to be read, with **Clear** under them.
- In a narrow window, Status scrolled sideways and its buttons were cut off; Settings did too at a larger text size. Below the table's width each app on Status is now a list row (its name with Open and its page beside it, its state and address under it), Settings' page list narrows and each setting's name goes above its field, and an address breaks only after a dot. Checked on every system in the smallest window, at the normal text size and one step up.
- Status' **This week** was drawn as side-by-side columns since the app's page came (the page's week bars shared its style). One thing a line again.
- On a Mac, the background agent could stay stopped until the next login: launchd kept it loaded but not running, and opening the app (homelab resume) only loaded an agent that was not loaded. Resume now starts it, as it already did on Windows and Linux, and what it said is kept in `scripts/logs/resume.log`.
- On a Mac, the switch to Homelab Wizard's own login item never happened, so Login Items kept a bare "homelab": macOS calls a login item it has never seen "not found", which the app took for a build without one. It registers it now (and falls back to the launchd job if that does not take).
- The desktop app uses golang.org/x/net 0.62.0, which fixes two flaws in its HTML parser published on 27 October 2026 (GO-2026-6866, GO-2026-6860).

## [0.13.0] - 2026-10-28

**More apps.** Ten new apps, from Actual Budget and Tandoor to Frigate and Nextcloud, and Kopia as a second backup beside Duplicati.

### New

- **Tandoor:** recipes with meal planning, shopping lists, and nutrition (Choose stacks › Household).
- **Linkwarden:** bookmarks for the household in shared collections, each page kept as a screenshot, a PDF, and text (Choose stacks › Documents).
- **Beszel:** how this machine and its apps are doing over time (CPU, memory, disks, network), with alerts (Choose stacks › System).
- **Kiwix:** Wikipedia and other reference libraries, readable offline from every device at home (Choose stacks › Documents).
- **Actual Budget:** an envelope budget, lighter than MoneyMatter, with the same budget on every device (Choose stacks › Finance).
- **Paperless-AI:** titles, tags, and correspondents for Paperless-ngx's documents from an AI model, Ollama on this machine or a service you choose (Choose stacks › Documents). Setup says how to get Ollama on each system once an app that uses it is installed.
- **Tdarr:** shrinks the media library by converting films and shows to a smaller format, kept to the night if you like (Choose stacks › Media Automation).
- **Frigate:** cameras recorded on this machine with person, car, and animal detection, and its events in Home Assistant (Choose stacks › Security).
- **Kopia:** a second, independent backup beside Duplicati, made by different software into its own encrypted repository, best on another drive (Choose stacks › System). Setup offers each drive plugged in for it, never the one with Duplicati's backups (`homelab kopia repository`). `homelab restore-test --auto --engine kopia` tests its restores as Duplicati's are tested, with its own monthly reminder.
- **Nextcloud:** the family's shared files synced to every phone and computer, with calendars and contacts if you want them; heavy, so in no starter (Choose stacks › Cloud & Files).
- **Firefly III:** a full household ledger, with budgets, bills, rules, and reports, and its importer for bank files (Choose stacks › Finance).

### Improved

- With Kopia installed, Backups shows its line beside Duplicati's: where its copy is, its own restore test, and **Test Kopia's restore**.
- Setup's *A second copy with Kopia* step says how Kopia's last restore test went, or that none has run yet.
- `homelab update` keeps a copy of each app's data just before it moves to a newer image (its folders and named volumes up to `UPDATE_COPY_LIMIT`, 2 GB each, and its dumps), and `homelab rollback` puts it back with the earlier image, setting today's aside in `recovery-staging/rolled-back` (ISSUE-0022, ADR-0020). The watchdog's own rollback does the same when the app was never well after its update; when it was, today's data stays and its alert says how to put the copy back.
- Each nightly backup notes the image every app runs, by its digest, beside the dumps; `homelab move in` starts those versions rather than the newest, so the data meets the version that wrote it, and names them for `homelab update` to move on.
- Sending an Immich album to family without an account: its note walks through the link, how long it lasts, and turning it off, and Setup gives the address to paste so links open away from home.
- Status counts a service once when two apps replace it (MoneyMatter and Actual Budget both stand in for YNAB).

### Fixed

- Ghostfolio starts again: it stopped at every start since its newer releases insist on TLS to its own database when asked to "prefer" it. Found by the nightly run's new catalog check.
- A registry that asks to wait a moment between downloads (lscr.io and GitHub's do, when several apps are installed at once) no longer stops an install with "try again in an hour": the homelab waits a few seconds and tries again, three times.
- Homebox starts again: its newer releases refuse to start without a key for signing API keys, which the homelab now generates (`HOMEBOX_API_KEY_PEPPER`, added to `.env` by the next `up`).
- File Browser, Seerr, and Homebox start on Linux under any account: they ran as their image's own user, which could not write the data folders unless your account happened to be uid 1000. They now run as you (`PUID`/`PGID`), as Vikunja does.
- With the homelab run as root (a server where everything is root), the backup folders `duplicati setup` makes and the restore test's folder are handed to `PUID`/`PGID`, so Duplicati, running as that account, can write in them.

## [0.12.0] - 2026-10-28

**The same on every system.** macOS, Windows, Linux, and SteamOS each get their own words, progress bars, tray, alerts, and look, and where one works differently the screen says so.

### New

- **Jellyfin on SteamOS:** SteamOS takes no native install, so there `homelab install jellyfin` and the **Movies and TV** pick install Jellyfin in a container (`jellyfin-container`), with its library where the native app keeps it (`JELLYFIN_DATA_DIR`) and backed up the same way. Elsewhere it is an alternative to the native app.
- **SteamOS:** Setup can install Docker in your home folder for you, and it survives SteamOS updates.
- **Settings › Appearance:** pick the theme, an accent colour, more contrast, the Islands layout, and the tray icon's colour.
- Setup checks that this machine can open the apps' tailnet addresses.
- `homelab domain resolver --undo` takes back this machine finding its apps by name (the resolver, and homelab's lines in the hosts file); `uninstall` says when they are left.
- `homelab doctor` reads KDE Plasma's sleep setting too (SteamOS's desktop), and warns when the apps would sleep with it.

### Improved

- Where a system does something differently, the screen says so: Beszel and Frigate on Choose stacks, the tray icon and its *needs a look* mark on Setup, the accent in Appearance, and Jellyfin's **Start** on Status.
- The Dock's "needs a look" count is set and read back on a Mac runner.
- The menu bar item is started on a Mac runner, its menu read and Quit clicked, and the tray item on a Windows runner, its icon in the notification area and its menu read; an alert is seen arriving in the Mac's Notification Center too.
- Jellyfin opened from Status and after a restart is tested on a Mac runner, with the app installed as its note says.
- On Windows, Setup says the tray icon and the container runtime start at sign-in, Windows' own word, instead of at login.
- Messages and the apps' notes use each system's own words ("tray icon", "this PC", "On this machine", its own hosts file) instead of the Mac's.
- On Windows, a new homelab takes the PC's time zone, and the install plan knows the PC's memory, as on the Mac and Linux.
- `homelab doctor` finds smartctl where its Windows installer puts it, and on SteamOS says why drive health cannot be read.
- A bar shows how far along the app's own update is, Setup's **Set up Docker for me** on SteamOS, and the tray's **Back up now** and **Update apps now** (which name the app at hand); in a terminal, `homelab up`, `install`, and `update` show a line per app instead of Docker's own output.
- The count of apps that need a look shows on the app's icon on Linux too (KDE, Ubuntu's dock), and as a dot on the tray icon on Windows and Linux.
- Changing the hosts file from the app on Windows and Linux asks for an administrator in a window, as on the Mac.
- A port another program holds is named in plain words, and on Windows port 53 says how to free it.

### Fixed

- On Windows and Linux, `duplicati setup` and `uninstall` no longer give the Mac's way to open `.env` (`open -e`) or to remove the app (the Trash); each system gets its own.
- On Linux, the homelab keeps the machine awake while plugged in again: Linux refused the background job's hold on sleep, so the machine slept as its settings said while `doctor` said otherwise. Setup's new step **This machine stays awake while plugged in** (or `homelab awake allow`) gives the permission once, with your password, and `doctor` now checks the hold is really there.
- Alerts on a Windows PC's screen come from *Homelab Wizard*, a name Windows knows, so they are shown; `homelab uninstall` removes the name again.
- After signing in on Windows, the homelab opens Docker Desktop itself if it has not started, as it already did with OrbStack on the Mac; on Linux it starts your own Docker service the same way.
- On Windows and Linux, keeping the computer awake now stops on battery, as it already did on the Mac, so a laptop unplugged sleeps as usual.
- `homelab doctor` warns when the machine's address changes and the apps would look for it at the old one.

## [0.11.0] - 2026-10-28

**Proven against real Docker.** Every night CI installs a real homelab, fills it, backs it up, wipes and restores it, updates and rolls back, and lets the watchdog heal it; the jobs and each build of the app are tried on macOS, Windows, and Linux. (The nightly run is still counting its first week of green nights.)

### New

- Every build of the app has its own version number (`v0.9.1-beta`, `v0.9.2-beta`, …) with its own release notes.
- If the app, its tray icon, or the background agent stops unexpectedly, Status says so the next time, with **Send the report**; the report carries what happened.
- `TAILSCALE_EXTRA_ARGS` passes flags to Tailscale, such as `--login-server=` for a tailnet on your own Headscale server.

### Improved

- The recovery kit is checked to hold none of `.env`'s secrets and to name the backup folder, every backup job, and the line for the Secrets passphrase.
- Every build of the app is opened on its own system before it is published: the Mac's DMG mounted and the app started from Applications, the Windows installer run silently and the app started, as the AppImage already was.
- Links, buttons, and the green, orange, and red states are easier to read on every system, in light and dark, and a screen reader hears whether each category on Status is open.
- The watchdog rebuilds an app whose container was removed, when it ran earlier in the week.
- Bundles install without their `@` (`homelab install adblock`), which PowerShell needs.

### Fixed

- The window that runs **Update apps** (and Fix it, and the other jobs) holds still: it no longer jumps as each app's row comes in, the page behind it waits until it closes instead of reshuffling, and its **Cancel** no longer shows once the job has started (it only hid the window; the job went on).
- Setup's **Addresses on your tailnet** no longer fails when Tailscale has only just started: it waits up to a minute for the sign-in link, or for the auth key to sign it in.
- `homelab signups open` in Home mode names Vaultwarden's address on the tailnet, not `https://passwords.` with no domain.
- After the app updates itself from an AppImage, its background jobs run the new release's CLI too; they kept the previous release's copy until the jobs were installed again.
- On Windows, removing the scheduled jobs (`homelab schedule remove`, `uninstall`) stops the running agent too, as on the Mac and Linux, instead of leaving it running until you sign out.
- The watchdog brings back an app you installed whose container was removed, not only the always-on ones; `homelab remove` takes an app out without the watchdog bringing it back.
- `homelab uninstall --data` deletes the apps' data on Linux with Docker Engine too: files the apps wrote as root had stopped it.
- **Set up the alert token** works with ntfy itself: it had read the new tokens where ntfy does not write them, and stopped with "creating the reader's access token".
- The background jobs' own logs no longer grow forever: each stays under 5 MB, with the older half kept in `<job>.1.log`, and the diagnostics report reads both.
- On Linux with Docker Engine, the proxy and Tailscale couldn't reach apps that run on the machine itself (Jellyfin, the phone companion).
- A failed `homelab db upgrade` could put the old files back under a running database.

## [0.10.0-beta] - 2026-10-28

**Fast, everywhere.** Status answers at once on every system: the window and the menu bar item share one look at Docker, the list draws before each app's check comes back, and each part of a load is timed.

### New

- `homelab status --timing` shows how long each part of Status takes on this machine.

### Improved

- Status shows your apps straight away; each app's "is it answering" check fills in a moment later, so one stuck app no longer holds up the page.
- Opening or folding a category on Status is instant.
- The window and the menu bar item share one look at Docker instead of each asking separately.
- Backups and Settings load their parts side by side.

## [0.9.0-beta] - 2026-10-24

**The beta.** Built for macOS, Windows, and Linux, and now being tested on real machines, starting with a Windows PC.

### New

- Move a homelab between a Mac, Windows, and Linux: Backups › **Move in…** adjusts the settings that differ between systems.

### Improved

- Signing in to Tailscale waits up to 30 minutes for you, instead of restarting with a new link after a minute.
- Tailscale's route home is this machine's own network, not a guessed `192.168.1.0/24`.
- **Test** in Settings saves the other settings its check needs (the domain with the Cloudflare token, the user with the password).

### Fixed

- **Install** on Choose stacks ran off the bottom of the window under a long plan.

## [0.8.0] - 2026-10-23

**Clearer messages, and Windows fixes.** What a new homelab says on its first day, checked line by line, and fixes for Windows.

### New

- A new logo: a blue shield with a house, readable at taskbar size.

### Improved

- Docker Hub's download limit is explained in plain words, with what to do.
- On a new homelab, `doctor` and `up` only mention what applies to you.
- Status says why the phone companion isn't running yet, without a warning colour.
- Dozzle (live logs) stays on this computer, since logs can hold secrets.
- Setup names settings the way Settings shows them.
- Alerts on the phone point at the right ntfy address in Home mode.
- **This week** on a new homelab lists what's still to set up, not things to worry about.
- Apps that run on the computer itself (Jellyfin) are described plainly on Choose stacks.
- Updating is one step: the homelab folder follows the app on its own.
- Home Assistant's note fits every system.

### Fixed

- **Fix it** said "done" even when one of its fixes failed.
- Setup's first step stayed unticked until the homelab folder existed.
- Status counted the phone companion before the scheduled jobs started it.
- On Windows: `homelab.cmd` needed Go, `install.ps1` didn't open the app, Navidrome wouldn't install, and AdGuard Home couldn't start where port 53 was taken.
- The weekly summary counted backups that didn't exist yet.

## [0.7.0] - 2026-10-23

**A first run anyone can do, in each system's own look.** A newcomer's first run, counted step by step, and the app drawn the way each system draws its own apps.

### New

- The app takes the accent colour you picked on Windows, the Mac, GNOME, and KDE.
- On KDE Plasma (SteamOS's desktop), the app is drawn in the Breeze style.
- The Mac's Dock icon shows how many apps need a look.
- The window opens where you left it.
- F5 checks the screen again on Windows and Linux.

### Improved

- Home mode skips the router step.
- Setup asks a laptop to stay plugged in and open.
- Backups and the outside check can wait a week without nagging.
- The install plan warns when the apps wouldn't fit in memory.
- Getting Started walks through the first open of the app without Terminal.
- More contrast when the system asks for it, and Windows' contrast themes keep everything readable.
- Settings spell every app the way the app does (Open WebUI, qBittorrent, AdGuard Home).

## [0.6.0] - 2026-10-23

**Security pass.** A review of the app's own code, and fixes for what it found.

### New

- Security scanners in CI: govulncheck, gosec, and npm audit.
- A threat review of the app's own code, with a 1.0 criterion for it.

### Improved

- GitHub Actions are pinned to exact commits.
- Watchtower and the Docker socket proxy stay on a version you choose.
- A phone's view of a log has secrets taken out.

### Fixed

- **Move in** could write outside the homelab folder through a link.
- A screen paired in kiosk mode could make changes.
- A phone paired over home Wi-Fi without encryption could make changes; it can only look now.
- The domain wasn't checked before reaching an administrator prompt.
- The app could open links other than web and email.
- An app update without GitHub's checksum wasn't refused.

## [0.5.0] - 2026-10-23

**Live Status, and apps that heal themselves.** Status follows Docker as things happen, and the homelab fixes or undoes what breaks.

### New

- Status updates live, following Docker's own events through the background agent.
- The watchdog restarts an app that hangs, and an update that leaves an app not answering is rolled back.
- **Explain this log**: the AI model on this machine reads an app's log and says what's wrong, in plain words. The log never leaves the machine.
- Kiosk mode: Status on a TV or a wall screen.
- Update shows what it brings before it starts: the newer releases' notes.
- Progress bars for longer jobs.

### Improved

- Status notices an app that runs but doesn't answer, and settings that aren't applied yet (**Fix it** applies them).
- The power card is live, with each busy app's last few minutes.
- Background work yields the CPU to the apps people are using.
- The app's screens are rebuilt in TypeScript and Preact, one screen at a time.

## [0.4.0] - 2026-10-22

**Windows and Linux.** The app, the installers, and self-update on every system, not just the Mac.

### New

- Windows and Linux builds of the app, published for every change.
- One-line installs: `install.sh` on Linux and the Mac, `install.ps1` on Windows.
- The app updates itself on Windows and Linux.
- External drives, backups, battery saver, and starting Docker work on Windows and Linux as on the Mac.
- Windows and Linux find the apps by name with a domain.
- Start Jellyfin from Status on Windows and Linux.
- **Update apps** in the menu bar and tray.

### Improved

- When an app fails to start, the app says why.
- When Docker refuses your account, the app says so instead of calling Docker stopped.
- `doctor` reads the sleep setting on Windows and Linux, and warns about SELinux labels that keep apps out of their folders.
- AdGuard Home runs beside systemd-resolved on Linux.
- Windows and Linux are no longer called "this Mac".
- Panels open as sheets.

### Fixed

- Self-update on Linux stopped itself halfway.
- Linux treated ports below 1024 as taken just because only root may use them.
- Setting up a homelab off the Mac, or with Go installed.

## [0.3.0] - 2026-10-21

**The Mac app grows up.** A menu bar item, one background agent, and an app that updates itself.

### New

- One-click update: the app replaces itself with the newest build, after checking GitHub's checksum.
- A stable channel that only moves on new versions.
- Home mode is the default for a new homelab.
- One background agent instead of six login items.
- Settings › **People**: add and remove household members.
- Open any app on a phone with a QR code.
- Move to a new machine from Backups.
- Status: each app's week, what each app keeps on disk, what's using power, and the weekly summary.
- Battery saver: the heavy apps pause on battery and start again on power.
- Text size: ⌘/Ctrl plus, minus, and 0.
- `install.sh`: install the Mac app from one Terminal line.

### Improved

- Status: healthy categories fold, one address per row, and starting a category's stopped apps is one click.
- Settings: a page per app, with the everyday settings first.
- VoiceOver: landmarks, live regions, and focus on each screen's heading.
- Setup says what each step gives you, and what runs in the background.
- Errors show as a macOS notification.
- Two Mac polish passes across every screen.

### Fixed

- CrowdSec restarted over and over at startup.
- The diagnostics report missed the logs of apps that kept restarting.

## [0.2.0] - 2026-10-15

**The Mac, tested.** Everything learned from running 0.1 on a real Mac, and the desktop app that came out of it.

### New

- The desktop app: Status, Choose stacks, Setup, Backups, and Settings, with a menu bar item.
- Home mode: no domain needed; Tailscale gives every app an https address.
- Single sign-on with Pocket ID, and `homelab person add` for each member of the household.
- The phone companion: Status and Backups on your phone.
- Updates you can undo: the image each app ran before its update is kept for a week.
- `homelab db upgrade`: a PostgreSQL major-version upgrade in one command.
- **Fix it**: starts what's stopped and reconnects what's disconnected.
- Backups: Duplicati jobs made for you, restore tests without its interface, and a monthly reminder to test.
- Ad blocking without a router change.
- Alerts on the screen, on the phone, and to an outside heartbeat.
- Your own apps: add any image with `homelab custom add`.
- Builds for Windows (including ARM) and Linux.
- New apps: Docmost, RomM, Ghostfolio, Baikal, PairDrop, PsiTransfer, Pocket ID, Vikunja, Tailscale, Home Assistant, Karakeep, Grocy, and more.

### Improved

- Apps grouped into nine categories, one Compose file each.
- Start here cards for Photos, Passwords, Movies and TV, Music, and Files.
- New apps get their addresses by themselves.
- A small baseline for new households.
- Every app's page under `services/` is a small wiki.
- Getting Started, Troubleshooting, and Upgrading guides.

### Fixed

- `.env` is saved atomically, with the previous version kept as `.env.bak`.
- SQLite apps (Vaultwarden, Uptime Kuma, and more) get consistent backups.
- Domain setup could drop HTTPS from every host if Nginx Proxy Manager was still starting.
- The home address could pick a VPN's tunnel instead of the home network.
- Vaultwarden sign-ups now always close on time.

## [0.1.0-alpha] - 2026-10-09

**First release, for a Mac.** The homelab on one Mac running OrbStack.

### New

- 17 apps started by `./homelab up`, and 17 more to add with `./homelab install`.
- The `homelab` command: install, plan, status, update, domain setup, backup, watchdog, restore test, and doctor.
- Nginx Proxy Manager with CrowdSec, protecting home and internet traffic alike.
- Scheduled jobs for startup, the nightly backup, and a watchdog every 15 minutes.
- A knowledge base in `docs/` and `services/`, and a page of the subscriptions it replaces.

[Unreleased]: https://github.com/Snooper42/homelab-wizard/compare/v0.16.0...HEAD
[0.16.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.10.0-beta...v0.11.0
[0.10.0-beta]: https://github.com/Snooper42/homelab-wizard/compare/v0.9.0-beta...v0.10.0-beta
[0.9.0-beta]: https://github.com/Snooper42/homelab-wizard/compare/v0.8.0...v0.9.0-beta
[0.8.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Snooper42/homelab-wizard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Snooper42/homelab-wizard/releases/tag/v0.2.0
[0.1.0-alpha]: https://github.com/Snooper42/homelab-wizard/blob/v0.2.0/CHANGELOG.md
