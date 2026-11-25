# Updating Loom

Loom has no in-app updater. Update the desktop app, the `loom` command, and
servers by installing the new release the same way you installed the old one.

## Desktop app

Download the installer for your platform from the
[releases page](https://github.com/tarze07/Loom/releases) and install it
over the previous version. Your threads, settings, and data stay.

If you installed the desktop app through a package manager, update it with that
package manager instead: `apt` (or download the new `.deb`) for Debian and
Ubuntu, your AUR helper on Arch, and `nix` on NixOS.

## The `loom` command

The desktop app includes the `loom` command and sets it up on each new version.
After installing a new desktop app, open the app and choose **Install** next to
**loom command** in **Settings → About**. If you installed `loom` with npm, update
it with your npm tooling instead.

## Servers

A server runs the `loom` command on some machine. To update one, install the new
version of `loom` on that machine — through the desktop app, npm, or the
[install scripts](https://loom.local/install.sh) — then restart the server the
way you started it. A server installed as a
[background service](./background-service.md) restarts with
`loom service restart`.

## Mobile app

Install App Store or Google Play releases as usual.
