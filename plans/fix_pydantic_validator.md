# Fix `mode='before'` Model Validators in Dagster Config

## Problem Summary

Dagster's `Config.__init__` performs custom preprocessing (discriminated unions, enum conversion, nested Config handling) **before** calling `super().__init__()`. This bypasses Pydantic's validation lifecycle, causing `model_validator(mode='before')` validators to never run on the raw input.

## Proposed Fix

Add a small block at the beginning of `Config.__init__` that explicitly runs any `mode='before'` model validators before the existing preprocessing logic. This is minimally invasive and maintains backward compatibility.

## Files to Modify

**[`python_modules/dagster/dagster/_config/pythonic_config/config.py`](python_modules/dagster/dagster/_config/pythonic_config/config.py)**

Add before-validator execution at the start of `Config.__init__`:

```python
def __init__(self, **config_dict) -> None:
    # Run mode='before' model validators before Dagster's preprocessing.
    # This is necessary because the preprocessing below happens outside
    # Pydantic's validation lifecycle, so validators wouldn't otherwise
    # see the raw input.
    if hasattr(self.__class__, '__pydantic_decorators__'):
        decorators = self.__class__.__pydantic_decorators__
        for decorator in decorators.model_validators.values():
            if decorator.info.mode == 'before':
                func = decorator.func
                if hasattr(func, '__func__'):
                    func = func.__func__
                config_dict = func(self.__class__, config_dict)
    
    # Existing preprocessing code follows...
    modified_data_by_config_key = {}
    # ... rest unchanged ...
```

## Test File

**[`python_modules/dagster/dagster_tests/core_tests/pythonic_config_tests/test_config_model_validators.py`](python_modules/dagster/dagster_tests/core_tests/pythonic_config_tests/test_config_model_validators.py)** (new file)

Create a test that demonstrates the issue and verifies the fix:

```python
from typing import Any

import pytest
from pydantic import BaseModel, model_validator

from dagster import Config, asset, materialize


class TestBeforeModeModelValidators:
    """Tests for model_validator(mode='before') support in Config classes."""

    def test_before_validator_transforms_input(self):
        """Test that mode='before' validators can transform raw input."""
        
        class MyConfig(Config):
            value: int
            
            @model_validator(mode='before')
            @classmethod
            def double_value(cls, data: Any) -> Any:
                if isinstance(data, dict) and 'value' in data:
                    data['value'] = data['value'] * 2
                return data
        
        config = MyConfig(value=5)
        assert config.value == 10  # Should be doubled by the validator

    def test_before_validator_with_discriminated_union(self):
        """Test that mode='before' validators run before discriminated union processing."""
        
        class OptionA(Config):
            type: str = "a"
            a_value: str
        
        class OptionB(Config):
            type: str = "b"
            b_value: int
        
        class MyConfig(Config):
            option: OptionA | OptionB
            
            @model_validator(mode='before')
            @classmethod
            def convert_basemodel_to_dict(cls, data: Any) -> Any:
                """Convert BaseModel instances to dicts for discriminated union compatibility."""
                if isinstance(data, dict):
                    for key, value in data.items():
                        if isinstance(value, BaseModel) and not isinstance(value, Config):
                            data[key] = value.model_dump()
                return data
        
        # Create a plain BaseModel (not a Config)
        class PlainOptionA(BaseModel):
            type: str = "a"
            a_value: str
        
        plain_option = PlainOptionA(a_value="test")
        
        # This should work - the before validator converts it to a dict
        config = MyConfig(option=plain_option)
        assert config.option.a_value == "test"

    def test_before_validator_runs_before_enum_conversion(self):
        """Test that mode='before' validators run before enum field processing."""
        from enum import Enum
        
        class Color(Enum):
            RED = "red"
            BLUE = "blue"
        
        class MyConfig(Config):
            color: Color
            
            @model_validator(mode='before')
            @classmethod
            def uppercase_color(cls, data: Any) -> Any:
                if isinstance(data, dict) and 'color' in data:
                    if isinstance(data['color'], str):
                        data['color'] = data['color'].upper()
                return data
        
        # Input is lowercase, validator uppercases it, then enum conversion handles it
        config = MyConfig(color="red")
        assert config.color == Color.RED

    def test_after_validator_still_works(self):
        """Ensure mode='after' validators continue to work correctly."""
        
        class MyConfig(Config):
            value: int
            
            @model_validator(mode='after')
            def validate_positive(self) -> 'MyConfig':
                if self.value < 0:
                    raise ValueError("value must be positive")
                return self
        
        config = MyConfig(value=5)
        assert config.value == 5
        
        with pytest.raises(ValueError, match="value must be positive"):
            MyConfig(value=-1)
```

## Testing the Fix

1. Clone the Dagster repo
2. Add the test file first (it should fail without the fix)
3. Apply the fix to `config.py`
4. Run the tests to verify they pass
```bash
cd python_modules/dagster
pytest dagster_tests/core_tests/pythonic_config_tests/test_config_model_validators.py -v
```


## Considerations

- **Backward compatibility**: This change is additive - existing code that doesn't use `mode='before'` validators is unaffected
- **Order of validators**: Multiple `mode='before'` validators will run in definition order (matching Pydantic's behavior)
- **Return value**: The validator must return the (potentially modified) data dict, which becomes the input for subsequent processing