import requests

import dagster as dg


# highlight-start
# Use ConfigurableResource to define the resource
class SunResource(dg.ConfigurableResource):
    # highlight-end
    @property
    def query_string(self) -> str:
        latittude = "37.615223"
        longitude = "-122.389977"
        time_zone = "America/Los_Angeles"
        return f"https://api.sunrise-sunset.org/json?lat={latittude}&lng={longitude}&date=today&tzid={time_zone}"

    def sunrise(self) -> str:
        data = requests.get(self.query_string, timeout=5).json()
        return data["results"]["sunrise"]
