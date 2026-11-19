resource "docker_image" "psql" {
  name         = "postgres:${var.version_psql}"
  keep_locally = false
}

resource "docker_volume" "psql_data" {
  name = "data"
  lifecycle {
    prevent_destroy = true
  }
}

resource "azurecaf_name" "random_name_psql" {
  name          = docker_image.psql.name
  resource_type = "azurem_resource_group"
  prefixes      = ["pin", "py", "d"]
  suffixes      = ["gou", "e", "b"]
  random_length = 4
  clean_input   = true
}

resource "docker_container" "psql" {
  name  = azurecaf_name.random_name_psql.result
  image = docker_image.psql.image_id

  ports {
    internal = 5432
    external = 5432
  }
  env = [
    "POSTGRES_USER=${var.psql_user}",
    "POSTGRES_PASSWORD=${var.psql_pass}",
    "POSTGRES_DB=${var.name_db}"
  ]
  volumes {
    volume_name    = docker_volume.psql_data.name
    container_path = "/var/lib/postgresql/data"
  }
  restart = "always"
}
