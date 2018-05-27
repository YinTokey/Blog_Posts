//动态规划 -- 硬币找零问题
function minCoins(coins,total,n){
	var T = [];

	for(let i = 0;i<n;i++){
		T[i] = []
		for (let j=0;j<= total;j++){
			if(j == 0){
				T[i][j] = 0;
				continue;
			}

			if(i == 0){
				T[i][j] = j/coins[i]; //硬币找零一定要有个 最小面额1，否则会无解
			}else{
				if(j >= coins[i]){
					T[i][j] = Math.min(T[i-1][j],1+T[i][j-coins[i]])
			
				}else{
					T[i][j] = T[i-1][j];
				}
			}

		}

	}
	findValue(coins,total,n,T);

	return T;

}

function findValue(coins,total,n,T){
	var i = n-1, j = total;
	while(i>0 && j >0){
		if(T[i][j]!=T[i-1][j]){
			//锁定位置,确定i,j值，开始找构成结果的硬币组合。 其实根据这种计算方法，只需要考虑最右边那一列，从下往上推。
			//console.log(T[i][j]);
			break
		}else{
			i--;
		}
	}

	var s = []; //存储组合结果
	
	while(i >= 0 && j > 0 ){
		
		s.push(coins[i]);
		j=j-coins[i];
		if(j <= 0){
			break; //计算结束，退出循环
		}
		//如果 i == 0,那么就在第 0 行一直循环计算，直到 j=0即可
		if(i>0){
			//console.log(i);
			while(T[i][j] == T[i-1][j]){
				i--;
				if(i== 0){
					break;
				}
			}
		}
	}
	
	console.log(s);
	//可以把数组s return 回去



}


var coins = [1,2,5,6];
var total = 19
var n = coins.length

console.log(minCoins(coins,total,n));