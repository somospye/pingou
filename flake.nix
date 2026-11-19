{
  description = "Pingou bot";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        packages = [
          pkgs.bun
          pkgs.vtsls
          pkgs.typescript
          pkgs.lefthook
          pkgs.biome
        ];
      in
      {
        devShells.default = pkgs.mkShell { inherit packages; };

      }
    );
}
