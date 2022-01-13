const {
	formatCurrency,
	getPackageList,
} = require('../../helpers/index.helpers');

exports.getHomePage = async (req, res) => {
	const { keyword = '' } = req.query;
	try {
		const packageData = await getPackageList(1, 12, keyword);
		const { packages } = packageData;

		res.render('user/home.pug', {
			packages,
			searchKeyword: keyword,
			helpers: {
				formatCurrency,
				totalPrice: (products = []) =>
					products.reduce((sum, p) => p.productPrice + sum, 0),
			},
		});
	} catch (error) {
		console.error('Function getHomePage Error: ', error);
		return res.render('404');
	}
};
