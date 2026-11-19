.PHONY: prepare.docker prepare.podman db fmt-terraform

prepare.docker:
	sudo docker-compose up -d
	@sleep 2
	$(MAKE) db

prepare.podman:
	podman-compose up -d
	@sleep 2
	$(MAKE) db

db: 
	bun db:generate
	bun db:migrate
	bun db:push

fmt-terraform:
	terraform fmt --recursive
