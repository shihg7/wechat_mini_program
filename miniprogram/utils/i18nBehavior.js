import i18n from './i18n';
export default Behavior({
  properties: {},
  methods: {
    t(key) {
        console.log('zy wx', key, i18n.t(key))
      return i18n.t(key);
    },
  },
});
