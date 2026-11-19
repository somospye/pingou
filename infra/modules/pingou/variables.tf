variable "url_image_docker_hub" {
  description = "Url de la imagen de docker"
  type = string
}

variable "token_bot" {
  description = "Token del bot"
  type = string
  sensitive = true
}

variable "psql_url" {
  description = "Url de la base de datos"
  type = string
  sensitive = true
}

variable "public_bot" {
  description = "Id publico del bot"
  type = string
}
