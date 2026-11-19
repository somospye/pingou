module "psql" {
  source    = "./modules/psql"
  psql_user = var.psql_user
  psql_pass = var.psql_pass
  name_db   = var.name_db
  version_psql = var.version_psql
}

module "pingou" {
  source               = "./modules/pingou"
  url_image_docker_hub = var.url_image_docker_hub
  token_bot            = var.token_bot_pingou
  psql_url             = "postgresql://${var.psql_user}:${var.psql_pass}@${var.vm_ip}:${module.psql.port}/${var.name_db}"
  public_bot           = var.public_bot
  depens-on = [
    module.psql
  ]
}
