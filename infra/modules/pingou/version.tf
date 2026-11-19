terraform {
  required_providers {
    docker = {
      source = "kreuzwerker/docker"
      version = "4.7.0"
    }
    azurecaf = {
      source = "aztfmod/azurecaf"
      version = "~> 2.0"
    }
  }
}



data "docker_registry_image" "pingou" {
  name = var.url_image_docker_hub
}

