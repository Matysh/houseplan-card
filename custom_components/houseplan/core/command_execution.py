"""One preparation budget, explicitly closed before any durable mutation."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar

from .input_policy import InputPolicy, has_input_scope, input_scope


class Preparation:
    def __init__(self, policy: InputPolicy):
        self.policy = policy
        self.scope = None
        self.finished = False

    def begin(self):
        if self.scope is None and not self.finished:
            if has_input_scope():
                raise ValueError("Command dispatch owns the preparation scope; do not wrap a durable command")
            scope = input_scope(self.policy)
            scope.__enter__()
            self.scope = scope

    def finish(self, error: BaseException | None = None):
        scope, self.scope = self.scope, None
        self.finished = True
        if scope is not None:
            scope.__exit__(type(error) if error is not None else None, error,
                           error.__traceback__ if error is not None else None)


_preparation: ContextVar[Preparation | None] = ContextVar("houseplan_command_preparation", default=None)


@contextmanager
def command_preparation(policy: InputPolicy):
    if _preparation.get() is not None:
        raise ValueError("Nested durable command dispatch is unsupported")
    preparation = Preparation(policy)
    token = _preparation.set(preparation)
    try:
        try:
            yield
        except BaseException as error:
            preparation.finish(error)
            raise
        else:
            preparation.finish()
    finally:
        _preparation.reset(token)


def begin_preparation():
    current = _preparation.get()
    if current is not None:
        current.begin()


def finish_preparation():
    current = _preparation.get()
    if current is not None:
        current.finish()
