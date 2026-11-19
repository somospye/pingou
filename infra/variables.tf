variable "vm_host" {
  description = "Host de la vm"
  type        = string
  sensitive   = true
}

variable "vm_ip" {
  description = "Ip de la vm"
  type        = string
}

# Pingou environments

variable "url_image_docker_hub" {
  description = "Url de la imagen de docker de pingou"
  type        = string
}

variable "token_bot_pingou" {
  description = "Token del bot"
  type        = string
  sensitive   = true
}

variable "public_bot" {
  description = "Id publico del bot"
  type        = string
}

# Psql environments

variable "psql_user" {
  description = "Nombre de usuario de la db"
  type        = string
  sensitive   = true
}

variable "psql_pass" {
  description = "Contraseña de usuario de la DB"
  type        = string
  sensitive   = true
}

variable "name_db" {
  description = "Nombre de la base de datos"
  type        = string
  sensitive   = true
}

