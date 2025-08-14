import { useEffect, useState } from 'react';
import { useMapbox } from '../../../context/mapContext';
import {
  findMeasurementAnchor,
  addMeasurementLayer,
  addMeasurementSource,
  createMeasuringLine,
  removeMeasurementLayer,
  removeMeasurementSource,
  changeCursor,
  cleanMeasurementControlLayers,
  MEASURE_LINE,
  MEASURE_LABEL,
  MEASURE_POINTS,
} from './helper/measureDistance';

export const MeasurementLayer = ({
  measureMode,
  setMeasureMode,
  setClearMeasurementIcon,
  clearMeasurementLayer,
  setClearMeasurementLayer,
  mapScaleUnit,
}) => {
  const { map } = useMapbox();
  const [measurePoints, setMeasurePoints] = useState(null);
  const [measureLine, setMeasureLine] = useState(null);
  const [measureLabel, setMeasureLabel] = useState(null);
  const clearMeasurementState = () => {
    setMeasureLine(MEASURE_LINE);
    setMeasureLabel(MEASURE_LABEL);
    setMeasurePoints(MEASURE_POINTS);
  };

  const handleClick = (e) => {
    const anchor = findMeasurementAnchor(e, map, measurePoints);
    if (!anchor?.features?.length) {
      cleanMeasurementControlLayers(map);
      setClearMeasurementIcon(false);
    }
    setMeasurePoints(anchor);
    map.getSource('measurePoints').setData(anchor);
    map.moveLayer('measure-points');
  };

  const handleDoubleClick = (e) => {
    setMeasureMode(false);
  };

  const handleMouseMovement = (e) => {
    const { line, label } = createMeasuringLine(e, measurePoints, mapScaleUnit);
    map.getSource('measureLine')?.setData(line);
    map.getSource('measureLabel')?.setData(label);
    map.moveLayer('measure-line');
    map.moveLayer('measure-label');
    setMeasureLine(line);
    setMeasureLabel(label);
  };

  useEffect(() => {
    if (!measureMode) {
      setClearMeasurementIcon(false);
    }
  }, [measureMode]);
  useEffect(() => {
    if (clearMeasurementLayer) {
      cleanMeasurementControlLayers(map);
      clearMeasurementState();
      setClearMeasurementIcon(false);
      setClearMeasurementLayer(false);
    }
  }, [clearMeasurementLayer, map]);

  useEffect(() => {
    if (!map) return;
    if (measurePoints?.features.length > 0 && measureMode) {
      setClearMeasurementIcon(true);
      map.on('mousemove', handleMouseMovement);
    }
    return () => {
      // cleanups
      if (map) {
        map.off('mousemove', handleMouseMovement);
      }
    };
  }, [map, measurePoints, mapScaleUnit]);

  useEffect(() => {
    if (map) {
      changeCursor(map, measurePoints, measureMode);
      if (measureMode) {
        addMeasurementSource(map, measurePoints, measureLine, measureLabel);
        addMeasurementLayer(map);
        map.doubleClickZoom.disable();
      } else if (!measureMode) {
        removeMeasurementSource(map);
        removeMeasurementLayer(map);
        clearMeasurementState();
        map.doubleClickZoom.enable();
      }
      return () => {
        removeMeasurementSource(map);
        removeMeasurementLayer(map);
      };
    }
  }, [map, measureMode]);

  useEffect(() => {
    if (!map) return;
    if (measureMode && map) {
      map.on('click', handleClick);
      map.on('dblclick', handleDoubleClick);
    }
    return () => {
      // cleanups
      if (map) {
        map.off('click', handleClick);
        map.off('dblclick', handleDoubleClick);
      }
    };
  });

  return null;
};
