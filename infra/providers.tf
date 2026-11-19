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


provider "docker" {
  host = var.vm_host
  ssh_opts = [
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-i",
    "~/.ssh/id_ed25519"
  ]
}


