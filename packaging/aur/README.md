# AUR packaging

This directory maintains the [`loom-bin`](https://aur.archlinux.org/packages/loom-bin) and
[`loom-nightly-bin`](https://aur.archlinux.org/packages/loom-nightly-bin) packages. Both
repackage the official x86_64 AppImage from GitHub Releases.

## Publishing

To update the package version and checksums, build it, and regenerate `.SRCINFO` from a GitHub
release tag, run `packaging/aur/scripts/release.sh` (or wire it into a release workflow).

To validate a release on Arch Linux:

```bash
sudo pacman -Syu --needed base-devel github-cli jq namcap
GH_TOKEN=$(gh auth token) RELEASE_TAG=v0.0.33 \
  packaging/aur/scripts/release.sh
```
