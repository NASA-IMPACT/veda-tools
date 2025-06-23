import { useEffect } from 'react';
import { useChart } from '../../../context/chartContext';

export const LineChart = ({ data, labels, legend, labelX, labelY, color="#ff6384", index=0, separateY=false }) => {
  // data should be an array of vector points
  // labels should be an array of the vector labels
  const { chart } = useChart();

  useEffect(() => {
    if (!chart || !data.length || !labels.length) return;

    // first reset the zoom
    chart.resetZoom();
    chart.options.plugins.tooltip.enabled = true;

    const newDataset = {
      label: legend,
      data: data,
      backgroundColor: color + '20',
      borderColor: color,
      showLine: false,
      xAxisID: `x-${index}`,
    };
    if (separateY) {
      newDataset.yAxisID = `y-${index}`;
    }

    // Ensure datasets array exists
    if (!chart.data.datasets) {
      chart.data.datasets = [];
    }

    // Add dataset at the specified index
    chart.data.datasets[index] = newDataset;

    // Update the labels
    chart.data.labels = labels;

    // update the axis labels
    chart.options.scales.y.display = separateY?false:true;
    chart.options.scales.x.display = false;

    // Ensure scales object exists
    if (!chart.options.scales) {
      chart.options.scales = {};
    }

    // Add scale configurations for x and y axes
    chart.options.scales[`x-${index}`] = {
      type: 'category',
      labels: labels,
      display: true,
      grid: {
        display: false,
        drawOnChartArea: false,
        // color: color,
      },
      ticks: {
        labels,
      },
      title: {
        text: labelX,
        display: !!labelX,
        // color: color
      }
    };

    chart.options.scales[`y-${index}`] = {
      display: separateY?true:false,
      grid: {
        display: false,
        drawOnChartArea: false,
        // color: color,
      },
      ticks: {
        // color: color,
      },
      title: {
        text: labelY,
        display: !!labelY,
        // color: color
      }
    };

    // update the chart
    chart.update();

  }, [chart, data, labels, legend, labelX, labelY, color, index]);

  return null;
};
