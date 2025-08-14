import { Chart } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import 'chartjs-adapter-luxon';
import { plugin } from './customPlugin';

Chart.register(zoomPlugin);
Chart.register(annotationPlugin);
Chart.register(plugin);
