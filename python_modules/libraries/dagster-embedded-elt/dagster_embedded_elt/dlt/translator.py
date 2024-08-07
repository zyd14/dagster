from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional, Sequence

from dagster import AssetKey, AutoMaterializePolicy
from dagster._annotations import public
from dlt.extract.resource import DltResource


@dataclass
class DagsterDltTranslator:
    @public
    def get_asset_key(self, resource: DltResource) -> AssetKey:
        """Defines asset key for a given dlt resource key and dataset name.

        This method can be overriden to provide custom asset key for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            AssetKey of Dagster asset derived from dlt resource

        """
        return AssetKey(f"dlt_{resource.source_name}_{resource.name}")

    @public
    def get_auto_materialize_policy(self, resource: DltResource) -> Optional[AutoMaterializePolicy]:
        """Defines resource specific auto materialize policy.

        This method can be overriden to provide custom auto materialize policy for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Optional[AutoMaterializePolicy]: The automaterialize policy for a resource

        """
        return None

    @public
    def get_deps_asset_keys(self, resource: DltResource) -> Iterable[AssetKey]:
        """Defines upstream asset dependencies given a dlt resource.

        Defaults to a concatenation of `resource.source_name` and `resource.name`.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Iterable[AssetKey]: The Dagster asset keys upstream of `dlt_resource_key`.

        """
        return [AssetKey(f"{resource.source_name}_{resource.name}")]

    @public
    def get_description(self, resource: DltResource) -> Optional[str]:
        """A method that takes in a dlt resource returns the Dagster description of the resource.

        This method can be overriden to provide a custom description for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Optional[str]: The Dagster description for the dlt resource.
        """
        return None

    @public
    def get_group_name(self, resource: DltResource) -> Optional[str]:
        """A method that takes in a dlt resource and returns the Dagster group name of the resource.

        This method can be overriden to provide a custom group name for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Optional[str]: A Dagster group name for the dlt resource.
        """
        return None

    @public
    def get_metadata(self, resource: DltResource) -> Mapping[str, Any]:
        """Defines resource specific metadata.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Mapping[str, Any]: The custom metadata entries for this resource.
        """
        return {}

    @public
    def get_owners(self, resource: DltResource) -> Optional[Sequence[str]]:
        """A method that takes in a dlt resource and returns the Dagster owners of the resource.

        This method can be overriden to provide custom owners for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Optional[Sequence[str]]: A sequence of Dagster owners for the dlt resource.
        """
        return None

    @public
    def get_tags(self, resource: DltResource) -> Mapping[str, str]:
        """A method that takes in a dlt resource and returns the Dagster tags of the structure.

        This method can be overriden to provide custom tags for a dlt resource.

        Args:
            resource (DltResource): dlt resource

        Returns:
            Optional[Mapping[str, str]]: A dictionary representing the Dagster tags for the
                dlt resource.
        """
        return {}
