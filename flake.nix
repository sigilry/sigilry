{
  description = "sigilry workspace dev shell with nix-dpm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-dpm.url = "github:0xsend/nix-dpm";
    flake-utils.url = "github:numtide/flake-utils";
    bun-overlay = {
      url = "github:0xbigboss/bun-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };
    flake-compat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, nixpkgs-unstable, nix-dpm, bun-overlay, flake-utils, flake-compat, ... }:
    let
      systems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
    in
      flake-utils.lib.eachSystem systems (system:
        let
          overlays = [
            bun-overlay.overlays.default
            nix-dpm.overlays.default
            (final: prev: {
              unstable = import nixpkgs-unstable {
                inherit (prev) system;
                overlays = [
                  bun-overlay.overlays.default
                  nix-dpm.overlays.default
                ];
                config.allowUnfree = true;
              };
            })
          ];
          pkgs = import nixpkgs {
            inherit system overlays;
            config.allowUnfree = true;
          };
        in {
          formatter = pkgs.alejandra;

          devShell = self.devShells.${system}.default;
          devShells.default = pkgs.mkShell {
            name = "sigilry-dev";

            nativeBuildInputs = [
              # Pin Node in Nix so CI and local shells share the same runtime baseline.
              pkgs.nodejs_22
              pkgs.bun
              pkgs.unstable.fnm
              pkgs.dpm
              pkgs.unstable.lefthook
              pkgs.temurin-bin-21
            ];

            # Prefer Nix-provided Java over any system Java.
            JAVA_HOME = pkgs.temurin-bin-21;

            shellHook = ''
              export PATH="$JAVA_HOME/bin:$PATH"

              # Keep CI on the Nix-provided Node; only use fnm conveniences for local dev shells.
              if [ -z "$CI" ]; then
                eval "$(fnm env --use-on-cd --corepack-enabled --shell bash)"
              fi
            '';
          };
        });
}
