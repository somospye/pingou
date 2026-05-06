{ pkgs, ... }:
{
  packages = with pkgs; [
    lazysql
    biome
    lefthook
  ];

  dotenv.enable = true;

  env = {
    POSTGRES_URL = "postgres://postgres:postgres@127.0.0.1:5432/postgres";
  };

  services = {
    postgres = {
      enable = true;
      package = pkgs.postgresql_18;
      initialDatabases = [
        {
          name = "postgres";
          user = "postgres";
          pass = "postgres";

          initialSQL = ''
            ALTER SCHEMA public OWNER TO postgres;
            GRANT ALL ON SCHEMA public TO postgres;
          '';
        }
      ];
      listen_addresses = "127.0.0.1";
      port = 5432;
    };
  };

  languages.javascript = {
    enable = true;
    bun.enable = true;
  };
}
