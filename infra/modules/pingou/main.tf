resource "docker_image" "pingou" {
  name          = "${data.docker_registry_image.pingou.name}@${data.docker_registry_image.pingou.sha256_digest}"
  pull_triggers = [data.docker_registry_image.pingou.sha256_digest]
  keep_locally  = false
}

resource "azurecaf_name" "random_name_pingou" {
  name          = data.docker_registry_image.pingou.name
  resource_type = "azurerm_resource_group"
  prefixes      = ["pin", "py", "bo"]
  suffixes      = ["gou", "e", "t"]
  random_length = 4
  clean_input   = true
}

resource "docker_container" "pingou" {
  name  = azurecaf_name.random_name_pingou.result
  image = docker_image.pingou.image_id

  env = [
    "BOT_TOKEN=${var.token_bot}",
    "POSTGRES_URL=${var.psql_url}",
    "PUBLIC_KEY=${var.public_bot}",
  ]
  restart = "always"
}
