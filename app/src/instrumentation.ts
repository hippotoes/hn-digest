import { config } from './config';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-grpc');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'hn-digest-app',
      }),
      traceExporter: new OTLPTraceExporter({
        url: config.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
  }
}
