FROM python:3.7.5-slim-stretch

RUN mkdir -p /tmp/results

WORKDIR /tmp/

# In a typical production deploy, use the following pattern.

# ADD requirements.txt .

# RUN pip install -r requirements.txt

# ADD dagster dagster
# ADD dagster-webserver dagster-webserver

ADD . .

RUN pip install --upgrade pip && pip install -e dagster && pip install dagster-webserver && pip install dagster-pandas && pip install dagstermill && pip install pytest

# ENTRYPOINT [ "dagster-webserver" ]
# 
# EXPOSE 3000
