from __future__ import annotations

from dataclasses import dataclass, field

from grpc_health.v1 import health, health_pb2

from services.agent.src.transports import grpc_server as agent_grpc_server


@dataclass
class FakeServer:
    binds: list[str] = field(default_factory=list)
    started: bool = False

    def add_insecure_port(self, bind: str) -> int:
        self.binds.append(bind)
        return 1

    def start(self) -> None:
        self.started = True


class FakeHealthServicer:
    def __init__(self) -> None:
        self.statuses: list[tuple[str, int]] = []

    def set(self, service_name: str, status: int) -> None:
        self.statuses.append((service_name, status))


def test_agent_grpc_server_registers_health_and_reflection(monkeypatch) -> None:
    fake_server = FakeServer()
    fake_health = FakeHealthServicer()
    added: dict[str, object] = {}

    monkeypatch.setattr(agent_grpc_server.grpc, "server", lambda *_args, **_kwargs: fake_server)
    monkeypatch.setattr(agent_grpc_server.health, "HealthServicer", lambda: fake_health)
    monkeypatch.setattr(
        agent_grpc_server.agent_service_pb2_grpc,
        "add_AgentServiceServicer_to_server",
        lambda servicer, server: added.update({"service_servicer": servicer, "service_server": server}),
    )
    monkeypatch.setattr(
        agent_grpc_server.health_pb2_grpc,
        "add_HealthServicer_to_server",
        lambda servicer, server: added.update({"health_servicer": servicer, "health_server": server}),
    )
    monkeypatch.setattr(
        agent_grpc_server.reflection,
        "enable_server_reflection",
        lambda service_names, server: added.update(
            {"reflection_names": tuple(service_names), "reflection_server": server}
        ),
    )

    server = agent_grpc_server.serve_grpc(bind="127.0.0.1:50051")

    assert server is fake_server
    assert fake_server.binds == ["127.0.0.1:50051"]
    assert fake_server.started is True
    assert added["service_server"] is fake_server
    assert added["health_server"] is fake_server
    assert added["reflection_server"] is fake_server
    assert fake_health.statuses == [
        ("", health_pb2.HealthCheckResponse.SERVING),
        (agent_grpc_server.AGENT_SERVICE_NAME, health_pb2.HealthCheckResponse.SERVING),
        (health.SERVICE_NAME, health_pb2.HealthCheckResponse.SERVING),
    ]
    assert added["reflection_names"] == (
        agent_grpc_server.AGENT_SERVICE_NAME,
        health.SERVICE_NAME,
        agent_grpc_server.reflection.SERVICE_NAME,
    )
