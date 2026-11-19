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
