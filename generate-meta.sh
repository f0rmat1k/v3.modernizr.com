cd i/js/modernizr-git/ && \
	git pull origin master && \
	npm install && \
	node lib/generate-meta.js && \
	cp dist/metadata.json ../ && \
	cd -
