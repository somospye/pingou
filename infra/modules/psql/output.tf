output "port" {
  description = "Devuelve los ports"
  value       = docker_container.psql.ports[0].external
}
