import PropTypes from 'prop-types';

export const graphNodeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  apiVersion: PropTypes.string,
  kind: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  namespace: PropTypes.string,
  plural: PropTypes.string,
  ready: PropTypes.string,
  synced: PropTypes.string,
  unresolved: PropTypes.bool,
  wraps: PropTypes.string,
});

export const graphFiltersShape = PropTypes.shape({
  types: PropTypes.arrayOf(PropTypes.string).isRequired,
  namespace: PropTypes.string.isRequired,
  kind: PropTypes.string.isRequired,
  search: PropTypes.string.isRequired,
  health: PropTypes.oneOf(['', 'healthy', 'unhealthy']).isRequired,
  focus: PropTypes.string.isRequired,
  limits: PropTypes.objectOf(PropTypes.number).isRequired,
});

export const optionShape = PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
});
