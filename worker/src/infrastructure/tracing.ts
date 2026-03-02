import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'hn-digest-worker',
  }),
  traceExporter: new OTLPTraceExporter({
    // Use gRPC port 4317
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

process.on('SIGTERM', () => {
  sdk.shutdown()
    .finally(() => process.exit(0));
});

export default sdk;
