with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "env";
  buildInputs = [
    bashInteractive
    nodejs_26
    yarn
  ];

  shellHook =
    ''
    export PATH=node_modules/.bin:$PATH
    '';
}
