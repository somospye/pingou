variable "psql_user" {
  description = "Nombre de usuario de la db"
  type = string
  sensitive = true
}

variable "psql_pass" {
  description = "Contraseña de usuario de la DB"
  type = string
  sensitive = true
}

variable "name_db" {
  description = "Nombre de la base de datos"
  type = string
  sensitive = true
}
